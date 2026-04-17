from duckduckgo_search import DDGS
import logging

logger = logging.getLogger(__name__)

def search_news_for_scenario(query: str, max_results: int = 3) -> str:
    """Uses DDG search to find recent context around a query and returns a combined summary."""
    logger.info(f"Searching web for query: {query}")
    try:
        with DDGS() as ddgs:
            # Try a news search prioritizing recency
            results = list(ddgs.news(query, max_results=max_results))
            if not results:
                # Fallback to general search
                results = list(ddgs.text(query, max_results=max_results))
                
        if not results:
            return "No recent relevant web search results found for the scenario."
            
        context_lines = []
        for i, res in enumerate(results):
            title = res.get('title', 'Unknown Title')
            body = res.get('body', res.get('snippet', ''))
            source = res.get('source', res.get('href', 'Unknown Source'))
            date = res.get('date', 'Recent')
            context_lines.append(f"{i+1}. [{date}] {title} ({source}) - {body}")
            
        return "\n".join(context_lines)
    except Exception as e:
        logger.error(f"Failed web search: {e}")
        return "Failed to fetch live web search context due to rate limits or network issues."
