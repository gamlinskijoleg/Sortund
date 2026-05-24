from fastapi import FastAPI, UploadFile, File
import uvicorn

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Welcome to the AI Worker!"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    audio_data = await file.read()

    return {"tags": ["rock", "guitar"], "confidence": 0.95}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
