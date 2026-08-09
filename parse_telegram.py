import urllib.request
from html.parser import HTMLParser

class TelegramParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_message = False
        self.messages = []
        self.current_message = ""

    def handle_starttag(self, tag, attrs):
        if tag == "div":
            attrs_dict = dict(attrs)
            if "tgme_widget_message_text" in attrs_dict.get("class", ""):
                self.in_message = True

    def handle_endtag(self, tag):
        if tag == "div" and self.in_message:
            self.in_message = False
            self.messages.append(self.current_message.strip())
            self.current_message = ""

    def handle_data(self, data):
        if self.in_message:
            self.current_message += data

url = "https://t.me/s/GoodDollarANN"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    html = response.read().decode()

parser = TelegramParser()
parser.feed(html)
for msg in parser.messages[-10:]:
    print("--- MESSAGE ---")
    print(msg)
