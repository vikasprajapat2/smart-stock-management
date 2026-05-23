from fastapi import APIRouter

router = APIRouter(
    prefix = "/auth",
    tags=['Authentication']
)

@router.get('/')
def test_auth():
    return {'message': "Auth route working"}
