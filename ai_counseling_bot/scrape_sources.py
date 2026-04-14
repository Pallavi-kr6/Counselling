import os
import requests
from bs4 import BeautifulSoup
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


JUNK_KEYWORDS = [
    "about us", "regions", "news", "press", "events",
    "policy", "policies", "careers", "dashboard",
    "library", "reports", "programmes", "programme",
    "governance", "partners", "committee", "statistics",
    "covid", "mpox", "cholera", "outbreak"
]



SOURCES = {
    "MoHFW_India": "https://www.mohfw.gov.in/",
    "TeleMANAS": "https://telemanas.mohfw.gov.in/",
    "WHO": "https://www.who.int/health-topics/mental-health",
    "NHS_UK": "https://www.nhs.uk/mental-health/",
    "Nami": "https://www.nami.org/research/",
    "Nami_2":"https://www.nami.org/ai-and-mental-health/",
    "VeryWellMind":"https://www.verywellmind.com/depression-4157261",
    "VeryWellMind_2":"https://www.verywellmind.com/strengthening-relationships-4162997",
    "Sangath":"https://www.sciencedirect.com/science/article/pii/S0277953622003008?via%3Dihub"
}



HEADERS = {
    "User-Agent": "Mozilla/5.0 (Mental Health Research Bot)"
}

def scrape_page(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=10, verify=False)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"Failed to fetch {url}: {e}")
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    data = []

    for tag in soup.find_all(["p", "li"]):
        text = tag.get_text(strip=True)

        text_lower = text.lower()
        if (
            80 < len(text) < 600
            and not any(junk in text_lower for junk in JUNK_KEYWORDS)
            ):
            data.append(text)


    return list(set(data))


os.makedirs("data", exist_ok=True)

with open("data/gov_health.txt", "w", encoding="utf-8") as f:
    for name, url in SOURCES.items():
        f.write(f"\n\nSOURCE: {name}\n")
        f.write("=" * 50 + "\n")

        paragraphs = scrape_page(url)
        for para in paragraphs:
            f.write("- " + para + "\n")

print("✅ Government mental health data scraped & saved.")
