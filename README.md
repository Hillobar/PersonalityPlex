# PersonalityPlex: Chat with Managed Personalities

PersonalityPlex builds upon PersonaPlex to allow you to create (and share) Personalities that are used in PersonaPlex. PersonalityPlex provides the following features:

- Voice cloning from ~10s audio clips
- Create a library of Personalities
- Talk to your Personalities
- Make edits to you Personalities for better behavior
- Clean UI

<table>
  <tr>
    <td>
      <img width="1030" height="893" alt="Screenshot 2026-02-14 110657" src="https://github.com/user-attachments/assets/7d498734-08dc-4dae-835d-b77824691de1" />
      <br>
      <em>Main Screen</em>
    </td>
    <td>
      <img width="1031" height="894" alt="Screenshot 2026-02-14 110712" src="https://github.com/user-attachments/assets/bca39bbb-0835-4be1-9085-add0bb738c96" />
      <br>
      <em>Personality Screen</em>
    </td>
  </tr>
  <tr>
    <td>
      <img width="1032" height="895" alt="Screenshot 2026-02-14 111218" src="https://github.com/user-attachments/assets/45e272c7-e3ef-4e96-adc6-9ccb38a7d506" />
      <br>
      <em>Clone a Voice</em>
    </td>
    <td>
      <img width="1031" height="893" alt="Screenshot 2026-02-14 110743" src="https://github.com/user-attachments/assets/03ff9de6-c4da-4006-9279-60a54e0778ab" />
      <br>
      <em>Talk to your Personality</em>
    </td>
  </tr>
</table>

### Installation

See the [Full Installation Guide (venv)](INSTALL.md) to get up and running.

## Usage

### First-Time Setup

1. Open your browser and go to **https://localhost:8998**
2. Click **Settings** at the bottom of the left sidebar
3. Enter the paths for the three required models:
   - **Moshi Weights** - path to the language model checkpoint
   - **Mimi Weights** - path to the audio codec model
   - **Text Encoder** - path to the tokenizer model
4. Click **Save**, then wait for loading to complete (the status indicator turns green when ready). This step will be skipped if the paths have already been set.

### Creating a Voice Embedding

1. In the left sidebar, click the dropdown menu and select **Create a voice embedding**
2. Click **Select audio file** and choose a voice sample (~10 seconds or more)
3. Enter a name for the embedding and click **Generate Embedding**
4. Optionally, type some test text and click **Test Embedding** to hear a preview of the cloned voice
5. The embedding will be stored in the `./Personalities/Embeddings` folder

### Creating a Personality

1. In the left sidebar, click the dropdown menu and select **Create new personality**
2. Fill in the personality details:
   - **Avatar** - click to upload a custom image
   - **Name** - give your personality a name
   - **Role (System Prompt)** - describe how the personality should behave (e.g. "You are a pirate captain who loves telling sea stories")
   - **Embedding** - select the voice embedding to use
3. Adjust generation parameters if desired (text/audio temperature, topK, seed)
4. Click **Save**
5. The Personality will be stored in the `./Personalities` folder

### Talking to a Personality

1. Click a personality in the left sidebar to select it
2. Click **Talk to your Personality**
3. Grant microphone permission when your browser prompts you
4. Start speaking — the personality responds in real-time with audio and text
5. The conversation is full-duplex, meaning you can speak and listen at the same time
6. Click **Disconnect** when you're done

