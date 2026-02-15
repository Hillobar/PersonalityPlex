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

## Step 5: Run the Server

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
python -m moshi.server  --ssl "./tmp"
```

or use the included `!start.bat` (has the same commands)

Once the server starts, open your browser and go to: **https://localhost:8998**

For more issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
