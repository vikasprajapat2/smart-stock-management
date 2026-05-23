from jose import jwt 
from datetime import datetime, timedalta

SECRET_KEY = 'supersecretkey'
ALGORITHM = "HS256"

def create_access_tokens(data):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedalta(hours=24)

    to_encode.update({'exp': expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithn=ALGORITHM
    )
