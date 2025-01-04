import fetch from "node-fetch";
global.fetch = fetch;

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

// Initialize OpenAI and Pinecone
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("llm-evaluation");

// Generate Embedding
async function generateEmbedding(text) {
  try {
    if (!text || text.trim() === "") {
      throw new Error("Cannot generate embedding for empty text.");
    }

    const response = await openai.embeddings.create({
      input: text,
      model: "text-embedding-ada-002",
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error("Embedding is empty or undefined.");
    }

    return embedding;
  } catch (error) {
    console.error("Failed to generate embeddings:", error.message);
    throw new Error("Failed to generate embeddings.");
  }
}

// Refined Judge Response using GPT-4
async function judgeResponse({ prompt, response }) {
  try {
    const evaluationPrompt = `
      Evaluate the following response to the given prompt:
      - Prompt: ${prompt}
      - Response: ${response}

      Provide a score for each of the following:
      1. Accuracy (0-100): How well does the response answer the prompt? Deduct points for incorrect or misleading answers.
      2. Relevancy (0-100): Is the response relevant to the prompt? Deduct points for off-topic or redundant content.
      3. Coherence (0-100): Is the response logically structured and easy to understand? Penalize for overly verbose or unclear language.
      4. Completeness (0-100): Does the response cover all necessary details without including irrelevant or excessive information? Penalize over-explaining or missing key points.

      Provide a brief explanation for each score under the "notes" field.

      Format your response as:
      {
        "accuracy": score,
        "relevancy": score,
        "coherence": score,
        "completeness": score,
        "notes": "Explanation of scores."
      }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: evaluationPrompt }],
    });

    const evaluation = completion.choices[0]?.message?.content;
    const parsedMetrics = JSON.parse(evaluation);

    if (
      parsedMetrics &&
      typeof parsedMetrics.accuracy === "number" &&
      typeof parsedMetrics.relevancy === "number" &&
      typeof parsedMetrics.coherence === "number" &&
      typeof parsedMetrics.completeness === "number" &&
      typeof parsedMetrics.notes === "string"
    ) {
      return parsedMetrics;
    } else {
      console.warn("Invalid evaluation format:", evaluation);
      return {
        accuracy: 0,
        relevancy: 0,
        coherence: 0,
        completeness: 0,
        notes: "Invalid evaluation format.",
      };
    }
  } catch (error) {
    console.error("Error during response evaluation:", error.message);
    return {
      accuracy: 0,
      relevancy: 0,
      coherence: 0,
      completeness: 0,
      notes: "Evaluation process failed.",
    };
  }
}

// Call OpenAI API
async function callOpenAI({ model, prompt }) {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });

    return (
      completion.choices[0]?.message?.content || "No response from OpenAI."
    );
  } catch (error) {
    console.error(`Error calling OpenAI for model ${model}:`, error.message);
    throw new Error(`Failed to fetch response from OpenAI for model ${model}`);
  }
}

// Call Gemini API
async function callGemini({ model, prompt }) {
  const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const response = await fetch(
      `${apiEndpoint}?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from Gemini."
    );
  } catch (error) {
    console.error(
      `Error calling Gemini API for model ${model}:`,
      error.message
    );
    return "No response from Gemini.";
  }
}

// Call Groq API
async function callGroq({ model, prompt }) {
  const apiEndpoint = `https://api.groq.com/openai/v1/chat/completions`;

  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 1.2,
        max_tokens: 1024,
        top_p: 0.9,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content === "safe") {
      console.warn(`Groq returned "safe" for prompt: "${prompt}"`);
      return "The model has strict moderation and returned 'safe'. Try another prompt or model.";
    }

    return content || "No response from Groq.";
  } catch (error) {
    console.error(`Error calling Groq API for model ${model}:`, error.message);
    throw new Error(
      `Failed to fetch response from Groq API for model ${model}`
    );
  }
}

// Store Experiment Results in Pinecone
async function storeExperiment(prompt, response, metrics) {
  const embedding = await generateEmbedding(prompt);

  const data = [
    {
      id: `prompt-${Date.now()}`,
      values: embedding,
      metadata: {
        prompt,
        response,
        accuracy: metrics.accuracy,
        relevancy: metrics.relevancy,
        coherence: metrics.coherence,
        completeness: metrics.completeness,
        notes: metrics.notes,
      },
    },
  ];

  await index.upsert(data);
}

// POST Handler
export async function POST(req) {
  try {
    const { prompt, llmConfigs } = await req.json();

    const results = await Promise.all(
      llmConfigs.map(async (config) => {
        let responseContent;

        if (config.provider === "OpenAI") {
          responseContent = await callOpenAI({ model: config.model, prompt });
        } else if (config.provider === "Gemini") {
          responseContent = await callGemini({ model: config.model, prompt });
        } else if (config.provider === "Groq") {
          responseContent = await callGroq({ model: config.model, prompt });
        } else {
          throw new Error(`Unknown provider: ${config.provider}`);
        }

        const metrics = await judgeResponse({
          prompt,
          response: responseContent,
        });

        console.log(`Processed Response for ${config.name}:`, responseContent);
        console.log(`Metrics for ${config.name}:`, metrics);

        await storeExperiment(prompt, responseContent, metrics);

        return {
          llmName: config.name,
          response: responseContent,
          metrics,
        };
      })
    );

    return NextResponse.json({ prompt, results });
  } catch (error) {
    console.error("Error in POST:", error.message);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

// Fetch Experiments
export async function GET(req) {
  try {
    const experiments = await index.query({
      topK: 100,
      includeMetadata: true,
      vector: Array(768).fill(0),
    });

    const results = experiments.matches.map((match) => ({
      id: match.id,
      metadata: match.metadata,
    }));

    return NextResponse.json({ experiments: results });
  } catch (error) {
    console.error("Error fetching experiments:", error.message);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
