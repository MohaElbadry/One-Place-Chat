## One-Place-Chat
- A web-based chat application that allows users to interact with popular APIs **(Jira, Trello, AWS, GCP, Azure, Shopify, Google Calendar, Slack, Discord ...)** through natural language conversations. The system uses an **MCP** (Model Context Protocol) AI model to understand user requests, provide relevant context, and automatically generate *HTTP* requests to the appropriate APIs. This eliminates the need for users to navigate complex GUIs or learn API documentation, offering a simple chat-based alternative for managing tasks across multiple platforms.
---
> web-based chat application that bridges the gap between natural language and API interactions.

---
Advantges:
* Speed
* Simplicity
* Intelligence
* All in one place
---
#### Exemple of WorkFlow
```
1>  "Create a Jira ticket for the login bug" 
AI> "I'll create that ticket for you. What priority should it be?" 
1>  "High priority, assign it to John" 
AI> Ticket created in 10 seconds
```

---
### Technology Stack
#### Frontend
- React.js with TypeScript Or Next
- **HTTP Client**: Axios
#### Backend
* Node.Js / Exress.js
* Real-Time?
* Database 
	* FireBase/MongoDB
	* VectorDB (ElasticSearsh / PgVector / ChromaDB)
#### AI / MCP
* API GPT/ Claude API
* MCP ? ***Need to learn***
* Data Scraping
#### Test
* Integration Test 
* Unit Test 
----
## Plan 
Learn TypeScript

Learn MCP

Learn CI/CD



> [!Problem]
> One thing there are some deficulty in the documentations it migth need to scrape data from the Website