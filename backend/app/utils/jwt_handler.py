from jose import jwt 
from datetime import datetime, timedelta

SECRET_KEY = 'mysecretkey'
ALGORITHM = "HS256"

def create_access_tokens(data):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=24)

    to_encode.update({'exp': expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )
