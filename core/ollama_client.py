import httpx
import logging

logger = logging.getLogger(__name__)

OLLAMA_HOSTS = [
    #"http://10.10.10.100:11434",
    #"https://ollama.splsystems.in",
    "http://localhost:11434"
]

def resolve_ollama_host(hosts: list[str]) -> str:
    """Iterates through provided hosts and returns the first healthy one."""
    # Use a synchronous client just for the initial boot-up check
    with httpx.Client(timeout=2.0) as client:
        for host in hosts:
            try:
                response = client.get(host)
                if response.status_code == 200:
                    logger.info(f"Resolved Ollama host: {host}")
                    return host
            except httpx.RequestError:
                logger.warning(f"Ollama host unreachable: {host}")
                continue
                
    logger.error("No Ollama hosts available. Pipeline will fail on embedding generation.")
    return "https://ollama.splsystems.in"  # Final desperate fallback

# Initialize constants
OLLAMA_HOST = resolve_ollama_host(OLLAMA_HOSTS)
EMBED_MODEL = "nomic-embed-text-v2-moe:latest"
LLM_MODEL   = "gemma4:latest"
