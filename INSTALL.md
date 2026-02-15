# PersonaPlex Installation Guide (venv)

This guide walks you through installing PersonaPlex using Python's built-in `venv` module instead of Conda.

## Prerequisites

- **Python 3.10+** installed on your system
- **Git** (to clone the repository)
- **NVIDIA GPU** with CUDA support
- **Opus audio codec** development library:
  - **Ubuntu/Debian:** `sudo apt install libopus-dev`
  - **macOS:** `brew install opus`
  - **Windows:** No extra step needed (bundled with the `sounddevice` package)
- A **Hugging Face account** with an access token. Accept the [PersonaPlex model license](https://huggingface.co/nvidia/personaplex-7b-v1) before proceeding.

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

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` appear at the beginning of your terminal prompt, confirming the environment is active.

## Step 3: Install Dependencies

**For most GPUs:**
```bash
pip install -r requirements.txt
```

**For Blackwell GPUs (RTX 50 series):**
```bash
# Install PyTorch with CUDA 13.0+ support FIRST (required for Blackwell)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130

# Then install the remaining dependencies
pip install -r requirements.txt
```

## Step 4: Install the Moshi Package

```bash
cd moshi
pip install -e .
cd ..
```

This installs the `moshi` package in editable/development mode so it can be imported from anywhere while the venv is active.

## Step 5: Set Up Your Hugging Face Token

Copy the example environment file and add your token:

```bash
cp .env.example .env
```

Open `.env` in a text editor and replace `your_token_here` with your actual [Hugging Face token](https://huggingface.co/settings/tokens):

```
HF_TOKEN=hf_your_actual_token_here
```

## Step 6: Run the Server

**Linux / macOS:**
```bash
SSL_DIR=$(mktemp -d); python -m moshi.server --ssl "$SSL_DIR"
```

**Windows (PowerShell):**
```powershell
$SSL_DIR = New-Item -ItemType Directory -Path "$env:TEMP\personaplex_ssl" -Force
python -m moshi.server --ssl "$SSL_DIR"
```

**Windows (Command Prompt):**
```cmd
mkdir %TEMP%\personaplex_ssl
python -m moshi.server --ssl %TEMP%\personaplex_ssl
```

Once the server starts, open your browser and go to: **https://localhost:8998**

## Day-to-Day Usage

Every time you open a new terminal to work with PersonaPlex, activate the virtual environment first:

**Windows:**
```cmd
cd PersonalityPlex
venv\Scripts\activate
```

**Linux / macOS:**
```bash
cd PersonalityPlex
source venv/bin/activate
```

Then launch the server as shown in Step 6.

To deactivate the virtual environment when you're done:
```bash
deactivate
```

## Quick Command Reference

| Task | Command |
|------|---------|
| Activate venv (Windows) | `venv\Scripts\activate` |
| Activate venv (Linux/macOS) | `source venv/bin/activate` |
| Start Web UI (Linux/macOS) | `SSL_DIR=$(mktemp -d); python -m moshi.server --ssl "$SSL_DIR"` |
| Start with CPU offload | Add `--cpu-offload` flag to the server command |
| Deactivate venv | `deactivate` |

## Troubleshooting

**"No module named 'moshi'"**
- Make sure the virtual environment is activated (you should see `(venv)` in your prompt)
- Make sure you ran `pip install -e .` inside the `moshi/` directory

**"Access denied" when downloading model**
- Accept the [model license](https://huggingface.co/nvidia/personaplex-7b-v1) on Hugging Face
- Verify your `HF_TOKEN` is set correctly in the `.env` file

**PowerShell execution policy error on Windows**
- Run: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

For more issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
