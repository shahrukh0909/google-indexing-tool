# Free Google indexing tool for your own site

A single Node.js script that asks Google to crawl every page in your sitemap, or just the pages you name, through Google's Indexing API. No subscription, no credits, no third-party service holding your keys.

I wrote it for my own site. The first run submitted 45 pages; Google accepted all 45 within about a minute. The full write-up, with screenshots of the setup, is here: [How I got every page of a new site crawled by Google in an hour, with a free tool](https://www.shahrukhmajeed.com/blog/free-google-indexing-tool).

## What it is, and what it is not

- It works only for sites **you own**: the script signs in with a Google service account that you make an Owner of your site in Search Console. It cannot submit someone else's pages.
- "Accepted" means Google has queued the page for a crawl. It does not guarantee the page will be indexed or ranked. Google decides that on its own.
- Google's documentation says the Indexing API is intended for pages with `JobPosting` or `BroadcastEvent` structured data. In my experience ordinary pages submitted this way get crawled quickly; whether they stay indexed depends on the page. Read [Google's quickstart](https://developers.google.com/search/apis/indexing-api/v3/quickstart) before you rely on it.
- Default quota is 200 submissions a day per project. Do not try to get around it with extra accounts; Google says that can get your access revoked.

## Setup (about 10 minutes)

1. **Create a Google Cloud project** at [console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate).
2. **Enable the Indexing API** for that project: [console.cloud.google.com/apis/library/indexing.googleapis.com](https://console.cloud.google.com/apis/library/indexing.googleapis.com).
3. **Create a service account** at [console.cloud.google.com/iam-admin/serviceaccounts](https://console.cloud.google.com/iam-admin/serviceaccounts). Give it no roles. Open it, go to **Keys**, **Add key**, **Create new key**, choose **JSON**. The key file downloads once.
4. **Make it an Owner of your site** in [Search Console, Users and permissions](https://search.google.com/search-console/users): add the service account's email address (it ends in `.iam.gserviceaccount.com`) with permission **Owner**. "Full" is not enough.
5. **Move the key file somewhere private**, outside any git repository:

```bash
mkdir -p ~/.keys && mv ~/Downloads/your-project-*.json ~/.keys/google-indexing.json && chmod 600 ~/.keys/google-indexing.json
```

## Usage

Requires Node.js 18 or newer. No dependencies to install.

```bash
# See what would be sent, without sending anything
SITE=https://www.example.com node index.mjs --dry-run

# Submit every page in your sitemap
SITE=https://www.example.com GOOGLE_INDEXING_KEY=~/.keys/google-indexing.json node index.mjs

# Submit only the pages you name
SITE=https://www.example.com GOOGLE_INDEXING_KEY=~/.keys/google-indexing.json node index.mjs /about /blog/new-post
```

The script reads `SITE/sitemap.xml` when you don't name pages.

## Reading the output

| Line | Meaning |
|---|---|
| `accepted` | Google queued the page for crawling |
| `403` | The service account is not an Owner in Search Console, or the Indexing API is not enabled on the project |
| `429` | Daily quota used up |
| `Sign-in failed` | Wrong key file, or the key was deleted in Google Cloud |

## When to run it

- After publishing a new page or changing an existing one. Name just those pages.
- Not on a schedule. Resubmitting unchanged pages adds nothing and uses quota.

## Keep the key safe

The key file grants Owner-level access to your site in Search Console. Never commit it, never paste it into a chat or a website, and never upload it to a third-party indexing service. If it leaks, delete the key in Google Cloud and create a new one.

## Licence

MIT. Use it, change it, share it.

Built by [Shahrukh Majeed](https://www.shahrukhmajeed.com), AI automation engineer and n8n Verified Creator. If a workflow of yours keeps breaking, I offer a [free diagnostic](https://www.shahrukhmajeed.com/diagnostic).
