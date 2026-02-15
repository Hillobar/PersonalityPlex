# PersonaPlex Installation Guide (venv)

This guide walks you through installing PersonaPlex using Python's built-in `venv` module..

## Prerequisites

- **Python 3.10+** installed on your system
- **Git** (to clone the repository)
- **NVIDIA GPU** with CUDA support
- **Opus audio codec** development library:
  - **Ubuntu/Debian:** `sudo apt install libopus-dev`
  - **macOS:** `brew install opus`
  - **Windows:** No extra step needed (bundled with the `sounddevice` package)

## Step 1: Clone the Repository

```bash
git clone https://github.com/Hillobar/PersonalityPlex.git
cd PersonalityPlex
```

## Step 2: Create and Activate a Virtual Environment

**Windows (Command Prompt):**
```cmd
python -m venv venv
venv\Scripts\activate
```

## Step 3: Install Dependencies

**For most GPUs:**
```bash
pip install -r requirements.txt
```

**For Blackwell GPUs (RTX 50 series):**
```bash
# Install PyTorch with CUDA 13.0+ support FIRST (required for Blackwell)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130

# Install the remaining dependencies
pip install -r requirements.txt

# Then install Triton
pip install triton-windows
```

## Step 4: Install the Moshi Package

```bash
cd moshi
pip install -e .
cd ..
```

This installs the `moshi` package in editable/development mode so it can be imported from anywhere while the venv is active.

## Step 5: Download the Model Files

Download the following files from the [PersonaPlex HuggingFace repo](https://huggingface.co/nvidia/personaplex-7b-v1/tree/main):
- [Moshi Model (model.safetensors)](https://huggingface.co/nvidia/personaplex-7b-v1/blob/main/model.safetensors)
- [Mimi Model (tokenizer-e351c8d8-checkpoint125.safetensors)](https://huggingface.co/nvidia/personaplex-7b-v1/blob/main/tokenizer-e351c8d8-checkpoint125.safetensors)
- [Text Tokenizer Model (tokenizer_spm_32k_3.model)](https://huggingface.co/nvidia/personaplex-7b-v1/blob/main/tokenizer_spm_32k_3.model)

Place these wherever you like to store model files. You will link to these within PersonalityPlex.

## Step 6: Run the Server

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
python -m moshi.server  --ssl "./tmp"
```

or use the included `!start.bat` (has the same commands)

Once the server starts, open your browser and go to: **https://localhost:8998**

For more issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
