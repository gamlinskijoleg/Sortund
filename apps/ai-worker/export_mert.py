import os
import torch
from transformers import AutoModel, AutoFeatureExtractor

model_name = "m-a-p/MERT-v1-95m"

print("📥 Завантаження кастомної моделі MERT з Hugging Face...")
# Завантажуємо ваги та препроцесор
model = AutoModel.from_pretrained(model_name, trust_remote_code=True)
processor = AutoFeatureExtractor.from_pretrained(model_name, trust_remote_code=True)

model.eval()

# 10 секунд аудіо на частоті 24kHz = 240000 сэмплів
dummy_input = torch.zeros(1, 240000, dtype=torch.float32)

output_dir = "app/ml/model/audio_mood"
os.makedirs(output_dir, exist_ok=True)
onnx_path = os.path.join(output_dir, "model.onnx")

print("⚡ Експорт графа в ONNX формат (Класичний режим)...")

with torch.no_grad():
    torch.onnx.export(
        model,
        (dummy_input,),
        onnx_path,
        input_names=["input_values"],
        output_names=["last_hidden_state"],
        dynamic_axes={
            "input_values": {0: "batch_size", 1: "sequence_length"},
            "last_hidden_state": {0: "batch_size", 1: "sequence_length"},
        },
        opset_version=14,
        do_constant_folding=True,
        # Явно вказуємо використовувати стандартний ONNX-режим
        operator_export_type=torch.onnx.OperatorExportTypes.ONNX,
    )

print(f"🎉 Успіх! Модель збережено тут: {onnx_path}")
