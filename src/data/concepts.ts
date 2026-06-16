import { AIConcept } from "../types";

export const DEFAULT_CONCEPTS: AIConcept[] = [
  {
    id: "prompt_engineering",
    name: "Prompt Engineering",
    description: "Master system role-play, few-shot conditioning, chain-of-thought, and instruction optimization.",
    emoji: "✍️",
    difficulty: "Beginner",
    estimatedTime: "2 min lesson",
    level: 1,
    prereqs: []
  },
  {
    id: "tokens",
    name: "Tokens & Context Window",
    description: "Deconstruct how LLMs chunk text, calculate token budgets, and manage memory context length.",
    emoji: "🧠",
    difficulty: "Beginner",
    estimatedTime: "2 min lesson",
    level: 1,
    prereqs: []
  },
  {
    id: "hallucinations",
    name: "Hallucinations",
    description: "Analyze autoregressive probability distributions, state biases, and prediction glitches.",
    emoji: "🔮",
    difficulty: "Beginner",
    estimatedTime: "2 min lesson",
    level: 1,
    prereqs: ["prompt_engineering"]
  },
  {
    id: "embeddings",
    name: "Embeddings",
    description: "Project tokens into high-dimensional geometric spaces where vector proximity represents semantic meaning.",
    emoji: "🕸️",
    difficulty: "Intermediate",
    estimatedTime: "2-3 min lesson",
    level: 2,
    prereqs: ["tokens"]
  },
  {
    id: "rag",
    name: "Retrieval-Augmented Generation (RAG)",
    description: "Inject real-time, external database knowledge directly into your model's active reasoning cycle.",
    emoji: "📚",
    difficulty: "Intermediate",
    estimatedTime: "2-3 min lesson",
    level: 2,
    prereqs: ["embeddings"]
  },
  {
    id: "fine_tuning",
    name: "Fine-Tuning",
    description: "Adapt general-domain weights into highly aligned task specialists through tailored parameter training.",
    emoji: "⚙️",
    difficulty: "Advanced",
    estimatedTime: "3 min lesson",
    level: 2,
    prereqs: ["rag"]
  },
  {
    id: "vector_db",
    name: "Vector Databases",
    description: "Index, store, and query billions of dimensional embedding points with low-latency search.",
    emoji: "🗄️",
    difficulty: "Intermediate",
    estimatedTime: "2-3 min lesson",
    level: 2,
    prereqs: ["embeddings"]
  },
  {
    id: "function_calling",
    name: "Function Calling / Tool Use",
    description: "Design LLMs that output precise structured JSON schemas to query live APIs and perform actions.",
    emoji: "🛠️",
    difficulty: "Advanced",
    estimatedTime: "3 min lesson",
    level: 3,
    prereqs: ["fine_tuning"]
  },
  {
    id: "agents",
    name: "AI Agents",
    description: "Establish stateful, autonomous loops backed by sensory tools, short/long-term memory, and reflection.",
    emoji: "🤖",
    difficulty: "Advanced",
    estimatedTime: "3 min lesson",
    level: 3,
    prereqs: ["function_calling"]
  },
  {
    id: "multi_agent",
    name: "Multi-Agent Systems",
    description: "Choreograph orchestras of specialized agents debating, grouping, and peer-reviewing to complete goals.",
    emoji: "👥",
    difficulty: "Advanced",
    estimatedTime: "3 min lesson",
    level: 3,
    prereqs: ["agents"]
  },
  {
    id: "evals",
    name: "LLM Evaluation & Metrics",
    description: "Develop rigorous programmatic evaluation suites, G-Eval analyzers, and robust test benchmarks.",
    emoji: "🧪",
    difficulty: "Advanced",
    estimatedTime: "3 min lesson",
    level: 4,
    prereqs: ["agents"]
  },
  {
    id: "latency_tradeoffs",
    name: "Latency vs Quality Tradeoffs",
    description: "Navigate TTFT, speculative decoding, model distillation, and KV caches to optimize performance.",
    emoji: "⏱️",
    difficulty: "Advanced",
    estimatedTime: "3 min lesson",
    level: 4,
    prereqs: ["evals"]
  },
  {
    id: "model_selection",
    name: "Model Selection for PMs",
    description: "Strategic criteria to choose between frontier models, local open-weights, and specialized size tiers.",
    emoji: "🎯",
    difficulty: "Advanced",
    estimatedTime: "3 min lesson",
    level: 4,
    prereqs: ["evals"]
  },
  {
    id: "ai_product_metrics",
    name: "AI Product Metrics",
    description: "Gauge product success by measuring cost-per-session, correction rates, and user diversion.",
    emoji: "📊",
    difficulty: "Advanced",
    estimatedTime: "3 min lesson",
    level: 4,
    prereqs: ["model_selection"]
  }
];

export function normalizeConceptId(idOrName: string): string {
  const clean = idOrName.trim().toLowerCase();
  
  // Direct matches of ID or Name
  const directMatch = DEFAULT_CONCEPTS.find(
    c => c.id.toLowerCase() === clean || c.name.toLowerCase() === clean
  );
  if (directMatch) return directMatch.id;

  // Normalized fuzzy matches (replacing dashes with underscores, removing special chars)
  const normalizedInput = clean.replace(/[^a-z0-9]/g, "");
  const fuzzyMatch = DEFAULT_CONCEPTS.find(c => {
    const normId = c.id.replace(/[^a-z0-9]/g, "");
    const normName = c.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normId === normalizedInput || normName === normalizedInput || clean.includes(normId) || normId.includes(clean);
  });

  if (fuzzyMatch) return fuzzyMatch.id;
  return idOrName; // Fallback
}
