# Adaptive Depth Protocol

> How Clawsight Scene Skills calibrate explanation depth, learning resources, and action plans to the user's technical proficiency.

## Why This Matters

Saying "Transformer introduced self-attention" is useless to a product manager. Saying "AI got better at understanding context" is useless to a systems engineer. The same AI milestone means different things at different depths — and leads to different actions.

## Proficiency Model

Career-mirror detects proficiency from behavioral evidence and outputs `technical_depth` for downstream skills.

### Detection Logic

| Signal | Technical | Mixed | Non-technical |
|--------|:---------:|:-----:|:------------:|
| GitHub repos with code | ✅ | ✅ (few) | ❌ |
| Languages in profile | 3+ programming langs | 1-2 or scripting only | None / SQL-only |
| Role keywords | engineer, developer, architect, SRE | PM, analyst, data scientist | operations, marketing, sales, HR, finance, design |
| AI tool evidence | API calls, fine-tuning, model code | Uses AI tools, some prompting | ChatGPT user or none |
| Education signals | CS/EE/Math degree | Adjacent (physics, stats) | Non-technical degree |

**Decision**: ≥3 Technical signals → `technical`. ≥2 Non-technical + 0 Technical → `non-technical`. Otherwise → `mixed`.

### Proficiency Levels

- **Technical** (T): Can read code, understand architectures, implement from scratch. Wants: repos, papers, implementation challenges.
- **Mixed** (M): Understands concepts, can use APIs/tools, may write scripts. Wants: tutorials, tool recommendations, conceptual depth with practical application.
- **Non-technical** (N): Thinks in business impact, workflows, outcomes. Wants: analogies, tool adoption paths, "what this means for my work."

## How to Adapt Each Section

### When Explaining AI Milestones (career-mirror, tech-spectrum)

| Milestone | Technical | Non-technical |
|-----------|-----------|---------------|
| Transformer (2017) | "Self-attention replaced RNN sequential processing with parallel computation — O(1) path length for any dependency. Your distributed systems intuition maps directly to understanding why this was revolutionary." | "AI learned to read entire documents at once instead of word-by-word — like scanning a page for key points instead of reading left to right. This is the foundation of ChatGPT." |
| MCP Protocol (2024) | "Standardized JSON-RPC interface for LLM↔tool communication. Think of it as the USB-C of AI: any model can call any tool through a common protocol. Your API design experience is directly transferable." | "AI tools can now talk to other software through a standard 'plug-and-play' interface — like how any phone charger now uses USB-C. This means AI can actually do things, not just chat." |
| RAG (2020) | "Retrieval-augmented generation combines dense retrieval (FAISS/Pinecone vector search) with in-context injection. Architecturally, it's a read-before-generate pipeline. Your data engineering background positions you to build the retrieval layer." | "AI can now look up real information before answering — like a student who checks their notes during an exam instead of guessing from memory. This makes AI much more reliable for your industry's specific knowledge." |

### When Recommending Actions (tech-compass)

| AI Skill Target | Technical | Mixed | Non-technical |
|----------------|-----------|-------|---------------|
| Understand Attention | Study [nanoGPT](https://github.com/karpathy/nanoGPT), implement a basic attention head from scratch, trace the computation graph | Watch Karpathy's "Let's Build GPT" video, then use the Transformer Explainer interactive tool, modify a simple example | Use the analogy: "Attention = smart spotlight that finds what matters." Try ChatGPT and notice how it handles long conversations — that's attention at work |
| Build with LLMs | Fork a LangChain template, build a RAG system with your own data, benchmark against baselines | Use Cursor/Claude Code to build a simple AI feature, integrate an API endpoint, iterate on prompts | Set up a Custom GPT for your workflow, create prompt templates for recurring tasks, measure time saved |
| Understand Agents | Read the MCP spec, build an MCP server, study CrewAI/AutoGen source code | Build a simple agent workflow with n8n or Flowise, connect 2-3 tools, observe failure modes | Use an agent product (Manus, Operator) for a real task, note what it does well and where it fails — this is your "AI intuition" |

### Understanding Verification

Every learning recommendation should include a "you'll know you understand this when..." checkpoint:

| Level | Verification Style |
|-------|-------------------|
| Technical | "Can you implement it from scratch without docs?" / "Can you explain the tradeoffs to a junior?" |
| Mixed | "Can you use the API to solve a real problem?" / "Can you explain why this approach vs alternatives?" |
| Non-technical | "Can you explain to a colleague what this technology does for your team?" / "Can you identify where in your workflow this applies?" |

## Curated Project References

### For Technical Users (Implementation-Level)

| Topic | Resource | Why |
|-------|----------|-----|
| Transformer fundamentals | [nanoGPT](https://github.com/karpathy/nanoGPT) | Minimal, readable GPT implementation. ~300 lines of core logic. |
| Attention from scratch | [Annotated Transformer](https://nlp.seas.harvard.edu/annotated-transformer/) | Line-by-line PyTorch implementation with explanations |
| RAG pipeline | [LangChain RAG Tutorial](https://python.langchain.com/docs/tutorials/rag/) | End-to-end: load → chunk → embed → retrieve → generate |
| Agent building | [MCP Quickstart](https://modelcontextprotocol.io/quickstart) | Build an MCP server in 30 minutes |
| Fine-tuning | [Hugging Face PEFT](https://github.com/huggingface/peft) | LoRA/QLoRA in practice |
| LLM inference | [llama.cpp](https://github.com/ggerganov/llama.cpp) | Understand quantization and local deployment |
| Full-stack AI app | [Vercel AI SDK](https://sdk.vercel.ai/) | Production-grade AI app patterns |

### For Non-Technical Users (Tool-Level)

| Goal | Resource | Why |
|------|----------|-----|
| Start using AI daily | ChatGPT / Claude — pick one, use it for 30 days | Build intuition through daily practice |
| Automate workflows | Zapier AI / n8n | Visual automation with AI steps, no code needed |
| Understand AI capabilities | [There's An AI For That](https://theresanaiforthat.com/) | Browse what AI can do in your specific domain |
| Build a custom AI tool | Custom GPTs (ChatGPT) | Create a domain-specific AI assistant in minutes |
| Stay current | Subscribe to "The Batch" by Andrew Ng | Weekly AI news, business-friendly language |
