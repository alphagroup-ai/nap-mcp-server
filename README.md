# NAP MCP Server

This is a Model Context Protocol (MCP) server implementation for the NAP API. It provides a standardized way to interact with NAP API endpoints through MCP tools and resources.

## Features

- Authentication with email/password
- Project management
- Resource access
- Tool execution
- Secure token handling

## Prerequisites

- Node.js 18.x or higher
- NPM 9.x or higher
- Running NAP API instance

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env` and update the configuration:
```bash
cp .env.example .env
```

4. Update the environment variables in `.env` with your NAP API configuration.

## Development

Start the development server:
```bash
npm run dev
```

## Build

Build the project:
```bash
npm run build
```

## Production

Start the production server:
```bash
npm start
```

## Available MCP Tools

### Authentication

- `login`: Authenticate with email and password
  - Parameters:
    - email: string
    - password: string

### Projects

- `list-projects`: Get all projects (requires authentication)
  - No parameters required

## Adding New Tools

To add new tools, modify `src/server.ts` and add new tool definitions following the MCP protocol specification.

## Security

- All endpoints require authentication via JWT tokens
- Tokens are automatically managed by the MCP server
- Sensitive data is never exposed in responses

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 