"use client";

import { useState } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardHeader,
} from "@mui/material";

export default function Home() {
  const [isLandingPage, setIsLandingPage] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedModels, setSelectedModels] = useState({
    "GPT-4": true,
    "GPT-3.5-Turbo": true,
    "Gemini 1.5 Flash": true,
    "Llama-3.3-70B Versatile": true,
    "gemma2-9b-it": false,
    "llama3-70b-8192": false,
  });

  const modelConfigs = [
    { name: "GPT-4", model: "gpt-4", provider: "OpenAI" },
    { name: "GPT-3.5-Turbo", model: "gpt-3.5-turbo", provider: "OpenAI" },
    { name: "Gemini 1.5 Flash", model: "gemini-1.5-flash", provider: "Gemini" },
    {
      name: "Llama-3.3-70B Versatile",
      model: "llama-3.3-70b-versatile",
      provider: "Groq",
    },
    { name: "gemma2-9b-it", model: "gemma2-9b-it", provider: "Groq" },
    { name: "llama3-70b-8192", model: "llama3-70b-8192", provider: "Groq" },
  ];

  const handleModelSelection = (modelName) => {
    setSelectedModels((prev) => ({
      ...prev,
      [modelName]: !prev[modelName],
    }));
  };

  const evaluatePrompt = async () => {
    if (!prompt.trim()) return; // Prevent empty prompts
    setLoading(true);

    const activeModels = modelConfigs.filter(
      (config) => selectedModels[config.name]
    );

    if (activeModels.length === 0) {
      alert("Please select at least one model to evaluate.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          llmConfigs: activeModels,
        }),
      });

      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {/* Top Bar */}
      <AppBar position="static" sx={{ backgroundColor: "#000" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            LLM Evaluation Platform
          </Typography>
          <Button color="inherit" onClick={() => setIsLandingPage(true)}>
            Home
          </Button>
        </Toolbar>
      </AppBar>

      {isLandingPage ? (
        // Landing Page
        <Box
          sx={{
            height: "calc(100vh - 64px)",
            background: "linear-gradient(to right, #000, #6a00ff)",
            display: "flex",
            alignItems: "center",
            padding: 4,
          }}
        >
          {/* Content on the left */}
          <Box sx={{ maxWidth: "600px", color: "#fff" }}>
            <Typography
              variant="h1"
              sx={{
                fontWeight: "bold",
                marginBottom: "10px",
                fontSize: "4rem",
              }}
            >
              LLM
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: "600",
                color: "#e0e0e0",
                marginBottom: "20px",
              }}
            >
              Evaluation Platform
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#e0e0e0",
                lineHeight: 1.6,
                marginBottom: "30px",
              }}
            >
              Evaluate multiple language models side by side, assess their
              performance with accuracy and relevance metrics, and make informed
              decisions with our intuitive platform.
            </Typography>
            <Button
              variant="contained"
              onClick={() => setIsLandingPage(false)}
              sx={{
                backgroundColor: "#fff",
                color: "#000",
                fontWeight: "bold",
                padding: "10px 20px",
                borderRadius: "8px",
                textTransform: "none",
                "&:hover": {
                  backgroundColor: "#e0e0e0",
                },
              }}
            >
              Get Started
            </Button>
          </Box>
        </Box>
      ) : (
        // Main Page
        <Box
          padding={4}
          maxWidth="lg"
          margin="auto"
          sx={{
            backgroundColor: "#f9fafb",
            minHeight: "100vh",
            color: "#333",
          }}
        >
          <Typography variant="h3" gutterBottom sx={{ fontWeight: "bold" }}>
            Evaluate Your Prompt
          </Typography>
          <Typography variant="body1" gutterBottom sx={{ color: "#555" }}>
            Compare the performance of selected language models by providing a
            prompt. View their responses and evaluation metrics.
          </Typography>
          <TextField
            fullWidth
            label="Enter your prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            margin="normal"
            placeholder="Type your prompt here..."
            variant="outlined"
            InputProps={{
              style: {
                backgroundColor: "#ffffff",
                color: "#000000",
              },
            }}
          />

          <Typography
            variant="h5"
            gutterBottom
            sx={{ marginTop: 3, fontWeight: "bold" }}
          >
            Select Models to Compare
          </Typography>
          <FormGroup row sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {modelConfigs.map((config) => (
              <FormControlLabel
                key={config.name}
                control={
                  <Checkbox
                    checked={selectedModels[config.name]}
                    onChange={() => handleModelSelection(config.name)}
                  />
                }
                label={config.name}
              />
            ))}
          </FormGroup>

          <Button
            variant="contained"
            color="primary"
            onClick={evaluatePrompt}
            disabled={loading}
            sx={{
              marginTop: 3,
              minWidth: 120,
              fontWeight: "bold",
              textTransform: "none",
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Evaluate Models"
            )}
          </Button>

          {/* Results Section */}
          <Box sx={{ marginTop: 5 }}>
            <Typography
              variant="h5"
              gutterBottom
              sx={{ fontWeight: "bold", marginBottom: 3 }}
            >
              Results
            </Typography>
            {results.length === 0 ? (
              <Typography variant="body1" sx={{ color: "#777" }}>
                No results yet. Submit a prompt to evaluate.
              </Typography>
            ) : (
              <Grid container spacing={4}>
                {results.map((result, idx) => (
                  <Grid item xs={12} md={6} key={idx}>
                    <Card sx={{ height: "100%" }}>
                      <CardHeader
                        title={result.llmName}
                        titleTypographyProps={{
                          variant: "h6",
                          fontWeight: "bold",
                        }}
                        sx={{ backgroundColor: "#f0f0f0", padding: 2 }}
                      />
                      <CardContent>
                        <Typography
                          variant="body1"
                          gutterBottom
                          sx={{ fontWeight: "bold" }}
                        >
                          Response:
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "#555", marginBottom: 2 }}
                        >
                          {result.response || "No response received."}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "#777", fontWeight: "bold" }}
                        >
                          Metrics:
                        </Typography>
                        <Typography variant="body2">
                          Accuracy: {result.metrics.accuracy}%
                        </Typography>
                        <Typography variant="body2">
                          Relevancy: {result.metrics.relevancy}%
                        </Typography>
                        <Typography variant="body2">
                          Coherence: {result.metrics.coherence}%
                        </Typography>
                        <Typography variant="body2">
                          Completeness: {result.metrics.completeness}%
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
