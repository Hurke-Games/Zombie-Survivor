import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini client with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Overseer AI Observation generation endpoint
app.post('/api/overseer/narrate', async (req, res) => {
  try {
    const { gameState, tacticalAction } = req.body;

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        fallback: true,
        message: 'No API key configured, using high-fidelity tactical deterministic engine',
      });
    }

    const prompt = `
You are the Overseer AI, an omniscient "God-view" simulator for a dark, unforgiving zombie survival game inspired by Project Zomboid.
Observe Knox County from a clinical, top-down satellite / drone perspective.

Current Simulation State Telemetry:
- Day: ${gameState?.day ?? 3}
- Clock: ${gameState?.timeFormatted ?? '07:30 AM'}
- Weather: ${gameState?.weather ?? 'Dense Fog, 12°C'}
- Grid Electricity: ${gameState?.gridPower ? 'OPERATIONAL' : 'TERMINATED (BLACKOUT)'}
- Water Grid: ${gameState?.waterGrid ? 'OPERATIONAL' : 'DRY / TERMINATED'}
- Subject ID: ${gameState?.survivor?.name ?? 'Subject #704 (James)'}
- Vitals: HP ${gameState?.survivor?.hp}% | Fatigue ${gameState?.survivor?.fatigue}% | Hunger ${gameState?.survivor?.hunger}% | Thirst ${gameState?.survivor?.thirst}% | Panic ${gameState?.survivor?.panic}% | Illness ${gameState?.survivor?.illness}% | Boredom ${gameState?.survivor?.boredom}% | Infection: ${gameState?.survivor?.isInfected ? 'LETHAL TRANSMISSION DETECTED (BITTEN)' : 'None'}
- Body Condition: ${gameState?.survivor?.injuries?.length ? gameState.survivor.injuries.join(', ') : 'Minor scratches, bandaged'}
- Equipped Weapon/Tool: ${gameState?.survivor?.equippedWeapon?.name ?? 'Crowbar'} (${gameState?.survivor?.equippedWeapon?.durability ?? 85}% durability)
- Equipped Secondary: ${gameState?.survivor?.equippedTool?.name ?? 'Claw Hammer'}
- Shelter & Fortifications: ${gameState?.shelterStats ?? 'Dilapidated suburban home, 2 barricaded windows, 1 wooden wall built, workbench active'}
- Audio Acoustic Trigger Level: ${gameState?.noiseLevel ?? 12} dB
- Surrounding Horde Count & Vectors: ${gameState?.zombieCount ?? 14} detected within 45m perimeter. Dense migration swarm detected 220m North along Dixie Highway.
- Dynamic Fires: ${gameState?.activeFires ?? 0} active flame clusters.
${tacticalAction ? `- Player's Chosen Tactical Directive: "${tacticalAction}"` : '- Trigger: Routine simulation observation scan & tactical analysis.'}

Requirements:
- Atmosphere: Gritty, realistic, clinical, bleak, Project Zomboid style.
- Perspective: Distant top-down god-view satellite/deity looking down on Knox County.
- Narration: Focus on environmental audio (creaking lumber, muffled shambling, rain patter), structural stress, weather, horde vectors.
- Sandbox rules: finite resources, equipment degradation, 100% fatal zombie bite infection, sensory triggers (noise/light/blood).
- Output must use the exact markdown headers specified:

#### 📊 WORLD STATUS
* **Time/Date:** [e.g., Day ${gameState?.day ?? 3}, ${gameState?.timeFormatted ?? '07:30 AM'}]
* **Weather:** [e.g., ${gameState?.weather ?? 'Dense Fog, 12°C'}]
* **Grid Power:** [Operational / Terminated]
* **Horde Activity:** [Macro movement, proximity clusters, sensory triggers]

#### 👁️ OBSERVATION LOG
[Provide a punchy, atmospheric, 2-3 paragraph tactical description of what is happening from the top-down view. Focus on the survivor's actions and the immediate threats surrounding them.]

#### 📈 SUBJECT VITAL METRICS
* **Health:** [Stable / Bleeding / Infected / Lethal]
* **Mental:** [Calm / Anxious / Panicked / Terrified]
* **Needs:** [Satiated / Hungry / Dehydrated / Exhausted]
* **Current Inventory/Gear:** [Key items equipped, condition]

#### 🎮 AVAILABLE ACTIONS
[Provide 3-4 realistic, high-stakes tactical choices numbered 1 to 4 with immediate trade-offs (risk vs reward, stamina, noise, durability, health).]
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are the Overseer AI. Cold, clinical, tactical, omniscient narrator of Project Zomboid survival simulation. Format strictly with specified markdown headers.',
        temperature: 0.7,
      },
    });

    const markdownText = response.text || '';
    res.json({
      success: true,
      markdown: markdownText,
    });
  } catch (error: any) {
    console.error('Overseer narration API error:', error);
    res.status(500).json({
      error: error.message || 'Simulation telemetry processing failure',
    });
  }
});

// Setup dev server with Vite or production static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Overseer AI Tactical Simulation Server online on http://0.0.0.0:${PORT}`);
  });
}

startServer();
