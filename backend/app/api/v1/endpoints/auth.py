from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.entities import User
from app.schemas.entities import UserCreate, UserLogin, UserRead, TokenResponse
from app.crud.operations import (
    get_user_by_email,
    get_user_by_username,
    create_user,
    authenticate_user,
)

router = APIRouter()


def set_auth_cookie(response: Response, token: str) -> None:
    """Helper to set a secure HttpOnly cookie for session management."""
    max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        max_age=max_age,
        expires=max_age,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Helper to delete the auth cookie on logout."""
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user account",
)
def register(
    user_in: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
):
    # Check for existing email
    if get_user_by_email(db, email=user_in.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    # Check for existing username
    if get_user_by_username(db, username=user_in.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this username already exists.",
        )

    # Create user with hashed password and initialized default risk settings
    user = create_user(db, user_in=user_in)
    token = create_access_token(subject=user.id)
    set_auth_cookie(response, token)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User login",
)
def login(
    login_in: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, email=login_in.email, password=login_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account.",
        )

    token = create_access_token(subject=user.id)
    set_auth_cookie(response, token)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post(
    "/logout",
    summary="Logout user session",
)
def logout(response: Response):
    clear_auth_cookie(response)
    return {"message": "Successfully logged out."}


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get authenticated current user profile",
)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    return UserRead.model_validate(current_user)
