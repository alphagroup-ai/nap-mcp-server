import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from 'axios';
const LOGIN_URL = "http://localhost:3001/login";
const CREATE_PROJECT_URL = "http://localhost:3001/projects";
const GET_CONNECTORS_URL = "http://localhost:3001/connectors";
// Add logging helper using console.error for stderr logging
const log = (level, message, data) => {
    const logData = {
        level,
        timestamp: new Date().toISOString(),
        message,
        ...data
    };
    // Log to stderr which will be captured by MCP
    console.error(JSON.stringify(logData));
};
async function login(email, password) {
    try {
        const { data: loginData } = await axios.post(LOGIN_URL, {
            email,
            password
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        const accessToken = loginData.access_token;
        const organizationId = loginData.user?.organization?.id;
        if (!accessToken || organizationId === undefined) {
            throw new Error("Login succeeded but access token or organization id not received.");
        }
        return { accessToken, organizationId };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            throw new Error(`Login failed: ${axiosError.response?.status} - ${axiosError.message}`);
        }
        throw error;
    }
}
// Create an MCP server instance
const server = new McpServer({
    name: "nap-mcp-server",
    version: "1.0.0"
});
//----------------- Projects -------------------
// Tool for Creating a Project
server.tool("create-project", {
    email: z.string(),
    password: z.string(),
    projectName: z.string(),
    // Optional parameters with defaults:
    projectDescription: z.string().default("Test21"),
    companyName: z.string().default("AG"),
    projectScope: z.string().default("")
}, async ({ email, password, projectName, projectDescription, companyName, projectScope }) => {
    try {
        // Step 1: Login to obtain access token and organization id
        const { accessToken, organizationId } = await login(email, password);
        // Step 2: Build the project creation payload using parameters and organization id
        const projectPayload = {
            name: projectName,
            description: projectDescription,
            company_name: companyName,
            project_scope: projectScope,
            organization_id: organizationId
        };
        // Step 3: Send a POST request to create the project with the access token
        const { data: createResponse } = await axios.post(CREATE_PROJECT_URL, projectPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return {
            content: [{
                    type: "text",
                    text: `Project created successfully. ${JSON.stringify(createResponse)}`
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            return {
                content: [{
                        type: "text",
                        text: `Project creation failed: ${axiosError.response?.status} - ${axiosError.message}`
                    }]
            };
        }
        return {
            content: [{
                    type: "text",
                    text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`
                }]
        };
    }
});
//----------------- Connectors -------------------
server.tool("list-all-available-connectors", {
    email: z.string(),
    password: z.string(),
    page: z.string().default("1"),
    perPage: z.string().default("100"),
    order: z.string().default("asc"),
    orderBy: z.string().default("name")
}, async ({ email, password, page, perPage, order, orderBy }) => {
    try {
        // Step 1: Login to obtain access token and organization id
        const { accessToken, organizationId } = await login(email, password);
        const { data: connectors } = await axios.get(GET_CONNECTORS_URL, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                page: parseInt(page),
                perPage: parseInt(perPage),
                order,
                orderBy
            }
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(connectors, null, 2)
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            return {
                content: [{
                        type: "text",
                        text: `Cannot get list of available connectors: ${axiosError.response?.status} - ${axiosError.message}`
                    }]
            };
        }
        return {
            content: [{
                    type: "text",
                    text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`
                }]
        };
    }
});
// Start the MCP server using STDIO transport for local process communication
const transport = new StdioServerTransport();
await server.connect(transport);
