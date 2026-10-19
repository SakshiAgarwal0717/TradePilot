import json
import logging
import os
import ssl
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import certifi
import httpx
from fastapi import HTTPException, status
from app.core.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def sanitize_ssl_environment() -> None:
    """Detects and clears dangling SSL CA bundle environment variables pointing to missing files.
    
    In certain development environments (notably Anaconda on Windows), `SSL_CERT_FILE`
    or `REQUESTS_CA_BUNDLE` may be permanently set to paths of relocated or deleted
    conda environments. If left untouched, any library relying on default env checks
    will fail with FileNotFoundError.
    
    If the path exists on disk, it is preserved. If it does not exist, it is safely
    removed from os.environ to prevent TLS/SSL initialization crashes.
    """
    for env_var in ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE"):
        ca_path = os.environ.get(env_var)
        if ca_path:
            if not os.path.isfile(ca_path):
                logger.warning(
                    "Environment variable %s points to a non-existent file path; "
                    "removing from environment to prevent TLS/SSL initialization failures.",
                    env_var,
                )
                os.environ.pop(env_var, None)

    cert_dir = os.environ.get("SSL_CERT_DIR")
    if cert_dir and not os.path.isdir(cert_dir):
        logger.warning(
            "Environment variable SSL_CERT_DIR points to a non-existent directory path; "
            "removing from environment to prevent TLS/SSL initialization failures."
        )
        os.environ.pop("SSL_CERT_DIR", None)


def get_ssl_context(cafile: Optional[str] = None) -> ssl.SSLContext:
    """Builds and returns an authentic, verified SSLContext with a valid CA bundle.
    
    Resolution order:
    1. Explicit cafile argument if provided and the file exists.
    2. SSL_CERT_FILE environment variable if set and the file exists.
    3. REQUESTS_CA_BUNDLE environment variable if set and the file exists.
    4. Certifi bundled CA bundle (certifi.where()), verified to exist.
    5. Python system default SSL context (ssl.create_default_context()).
    
    Guarantees:
    - Never disables verification (verify=False is strictly forbidden).
    - check_hostname is True and verify_mode is CERT_REQUIRED.
    - No machine-specific paths hardcoded.
    """
    sanitize_ssl_environment()

    # 1. Explicit argument
    if cafile and os.path.isfile(cafile):
        try:
            return ssl.create_default_context(cafile=cafile)
        except Exception as exc:
            logger.warning("Failed to load explicit CA file (%s); falling back.", type(exc).__name__)

    # 2. SSL_CERT_FILE
    ssl_cert_file = os.environ.get("SSL_CERT_FILE")
    if ssl_cert_file and os.path.isfile(ssl_cert_file):
        try:
            return ssl.create_default_context(cafile=ssl_cert_file)
        except Exception as exc:
            logger.warning("Failed to load SSL_CERT_FILE (%s); falling back to certifi.", type(exc).__name__)

    # 3. REQUESTS_CA_BUNDLE
    requests_ca_bundle = os.environ.get("REQUESTS_CA_BUNDLE")
    if requests_ca_bundle and os.path.isfile(requests_ca_bundle):
        try:
            return ssl.create_default_context(cafile=requests_ca_bundle)
        except Exception as exc:
            logger.warning("Failed to load REQUESTS_CA_BUNDLE (%s); falling back to certifi.", type(exc).__name__)

    # 4. Certifi
    try:
        certifi_path = certifi.where()
        if certifi_path and os.path.isfile(certifi_path):
            return ssl.create_default_context(cafile=certifi_path)
    except Exception as exc:
        logger.warning("Failed to load certifi CA context (%s); falling back to default.", type(exc).__name__)

    # 5. System default
    return ssl.create_default_context()


# Run sanitization at module load to protect process startup
sanitize_ssl_environment()


class BaseAiProviderClient(ABC):
    """Abstract base provider interface for AI completion services."""

    @abstractmethod
    def is_configured(self) -> bool:
        """Returns True if the required credentials are set."""
        pass

    @abstractmethod
    def call_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1000,
    ) -> Dict[str, Any]:
        """Executes completion and returns parsed dictionary or raises controlled HTTPException."""
        pass


class OpenRouterProviderClient(BaseAiProviderClient):
    """Isolated client for OpenRouter chat completions.
    
    Adheres to:
    - Never logs secrets, bearer tokens, or full unmasked payloads.
    - Sets a finite timeout.
    - Emits controlled, sanitized HTTPExceptions conforming to project error format.
    - Easy to mock in automated testing.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.model_name = model_name or settings.AI_MODEL_NAME
        self.timeout = timeout or settings.AI_REQUEST_TIMEOUT_SECONDS

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def call_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1000,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI Review Assistant is not configured. OPENROUTER_API_KEY is not set.",
            )

        headers = {
            "Authorization": f"Bearer {self.api_key.strip()}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://tradepilot.io",
            "X-Title": "TradePilot Decision Support",
        }

        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }

        try:
            ssl_context = get_ssl_context()
            with httpx.Client(timeout=self.timeout, verify=ssl_context) as client:
                response = client.post(
                    OPENROUTER_API_URL,
                    headers=headers,
                    json=payload,
                )
        except httpx.TimeoutException:
            logger.warning("OpenRouter provider request timed out.")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="AI service request timed out. Please try again later.",
            )
        except (ssl.SSLError, OSError) as exc:
            logger.error("TLS/SSL certificate error communicating with OpenRouter provider: %s", type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to establish secure connection to AI provider (TLS/SSL certificate error).",
            )
        except httpx.RequestError as exc:
            logger.error("OpenRouter provider network error: %s", type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to connect to AI provider.",
            )

        if response.status_code == 401:
            logger.error("OpenRouter rejected authentication key.")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI provider rejected configuration credentials.",
            )
        elif response.status_code == 429:
            logger.warning("OpenRouter rate limit reached.")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI service rate limit exceeded. Please wait a moment before retrying.",
            )
        elif response.status_code >= 400:
            err_msg = ""
            try:
                err_data = response.json()
                if isinstance(err_data, dict) and "error" in err_data:
                    err_obj = err_data["error"]
                    if isinstance(err_obj, dict):
                        err_msg = err_obj.get("message", "")
                    elif isinstance(err_obj, str):
                        err_msg = err_obj
            except Exception:
                pass

            logger.error("OpenRouter returned HTTP %s: %s", response.status_code, err_msg)
            detail = f"AI provider returned an upstream error (HTTP {response.status_code})."
            if err_msg:
                detail = f"AI provider returned an upstream error (HTTP {response.status_code}): {err_msg}"
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=detail,
            )

        # Guard against excessively large response bodies (> 500 KB)
        if len(response.content) > 500_000:
            logger.error("AI provider returned an excessively large payload (%d bytes)", len(response.content))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI provider returned an unexpectedly large payload.",
            )

        try:
            data = response.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI provider returned a non-JSON response.",
            )

        try:
            choices = data.get("choices")
            if not choices or not isinstance(choices, list):
                raise ValueError("Missing choices in response")
            message = choices[0].get("message")
            if not message or not isinstance(message, dict):
                raise ValueError("Missing message in choices")
            content_str = message.get("content")
            if not content_str or not isinstance(content_str, str):
                raise ValueError("Empty or non-string message content")

            parsed_content = json.loads(content_str.strip())
            return parsed_content
        except (ValueError, json.JSONDecodeError) as exc:
            logger.error("OpenRouter returned malformed model output: %s", str(exc))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI provider returned invalid structured output.",
            )


class GeminiProviderClient(BaseAiProviderClient):
    """Isolated client for Google Gemini generateContent REST API.
    
    Uses standard official Gemini REST endpoint with httpx:
    POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    Header: x-goog-api-key: {key}
    
    Adheres to:
    - Never logs secrets, api-keys, or full unmasked payloads.
    - Sets a finite timeout.
    - Emits controlled, sanitized HTTPExceptions conforming to project error format.
    - Easy to mock in automated testing.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = model_name or settings.GEMINI_MODEL_NAME
        self.timeout = timeout or settings.AI_REQUEST_TIMEOUT_SECONDS

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def call_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1000,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI Review Assistant is not configured. GEMINI_API_KEY is not set.",
            )

        url = GEMINI_API_URL_TEMPLATE.format(model=self.model_name)
        headers = {
            "x-goog-api-key": self.api_key.strip(),
            "Content-Type": "application/json",
        }

        # Adapt messages to Gemini generateContent schema
        # System instructions separated into system_instruction, user messages into contents
        system_texts = [m["content"] for m in messages if m.get("role") == "system"]
        user_texts = [m["content"] for m in messages if m.get("role") != "system"]

        payload: Dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "\n\n".join(user_texts)}],
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "application/json",
            },
        }

        if system_texts:
            payload["system_instruction"] = {
                "parts": [{"text": "\n\n".join(system_texts)}]
            }

        try:
            ssl_context = get_ssl_context()
            with httpx.Client(timeout=self.timeout, verify=ssl_context) as client:
                response = client.post(
                    url,
                    headers=headers,
                    json=payload,
                )
        except httpx.TimeoutException:
            logger.warning("Gemini provider request timed out.")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="AI service request timed out. Please try again later.",
            )
        except (ssl.SSLError, OSError) as exc:
            logger.error("TLS/SSL certificate error communicating with Gemini provider: %s", type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to establish secure connection to AI provider (TLS/SSL certificate error).",
            )
        except httpx.RequestError as exc:
            logger.error("Gemini provider network error: %s", type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to connect to AI provider.",
            )

        if response.status_code == 400:
            logger.error("Gemini rejected request payload or configuration.")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Gemini provider rejected request parameters.",
            )
        elif response.status_code == 403 or response.status_code == 401:
            logger.error("Gemini rejected authentication key.")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI provider rejected configuration credentials.",
            )
        elif response.status_code == 429:
            logger.warning("Gemini rate limit reached.")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI service rate limit exceeded. Please wait a moment before retrying.",
            )
        elif response.status_code >= 400:
            err_msg = ""
            try:
                err_data = response.json()
                if isinstance(err_data, dict) and "error" in err_data:
                    err_obj = err_data["error"]
                    if isinstance(err_obj, dict):
                        err_msg = err_obj.get("message", "")
                    elif isinstance(err_obj, str):
                        err_msg = err_obj
            except Exception:
                pass

            logger.error("Gemini returned HTTP %s: %s", response.status_code, err_msg)
            detail = f"AI provider returned an upstream error (HTTP {response.status_code})."
            if err_msg:
                detail = f"AI provider returned an upstream error (HTTP {response.status_code}): {err_msg}"
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=detail,
            )

        # Guard against excessively large response bodies (> 500 KB)
        if len(response.content) > 500_000:
            logger.error("Gemini returned an excessively large payload (%d bytes)", len(response.content))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI provider returned an unexpectedly large payload.",
            )

        try:
            data = response.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI provider returned a non-JSON response.",
            )

        try:
            candidates = data.get("candidates")
            if not candidates or not isinstance(candidates, list):
                raise ValueError("Missing candidates in response")
            content_obj = candidates[0].get("content")
            if not content_obj or not isinstance(content_obj, dict):
                raise ValueError("Missing content in candidates")
            parts = content_obj.get("parts")
            if not parts or not isinstance(parts, list):
                raise ValueError("Missing parts in content")
            text_str = parts[0].get("text")
            if not text_str or not isinstance(text_str, str):
                raise ValueError("Empty or non-string text in parts")

            parsed_content = json.loads(text_str.strip())
            return parsed_content
        except (ValueError, json.JSONDecodeError) as exc:
            logger.error("Gemini returned malformed model output: %s", str(exc))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI provider returned invalid structured output.",
            )


def get_ai_provider_client() -> BaseAiProviderClient:
    """Factory helper resolving configured AI provider client."""
    provider = settings.AI_PROVIDER_DEFAULT.lower()
    if provider == "gemini":
        return GeminiProviderClient()
    elif provider == "openrouter":
        return OpenRouterProviderClient()
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unsupported AI provider configuration: '{provider}'.",
        )
