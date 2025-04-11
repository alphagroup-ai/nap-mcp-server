import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
const LOGIN_URL = "http://localhost:3001/login";
const CREATE_PROJECT_URL = "http://localhost:3001/projects";
const GET_CONNECTORS_URL = "http://localhost:3001/connectors";
const ADD_CONNECTOR_TO_PROJECT_URL = "http://localhost:3001/project-applications/";
const GET_PROJECT_CONNECTOR_CLIENT_CREDENTIALS_URL = `http://localhost:3001/projects/{id}/applications-credentials`;
const CREATE_IMPLEMENTATION_URL = "http://localhost:3001/implementations";
const GET_FLOW_TYPES_URL = "http://localhost:3001/parametrics/flow-types";
const GET_CONNECTORS_LIST_CONCISE_URL = "http://localhost:3001/connectors/list";
const GET_CONNECTORS_FUNCTIONS_URL = "http://localhost:3001/connectors/functions";
const CREATE_WORKFLOW_URL = "http://localhost:3001/integration-flows";
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
// ---- Implementations -------
server.tool("add-client-credentials-to-project", {
    email: z.string(),
    password: z.string(),
    projectId: z.number().describe("The Id of the project to add the client credentials to."),
    name: z.string().describe("The name of the client to add to the project"),
    baseUrl: z.string().describe("The base url is the url for the service that handles the webhook from external system."),
    externalId: z.string(),
    extraData: z.record(z.string(), z.any()),
    credentials: z.array(z.object({
        connector: z.object({
            id: z.number(),
            name: z.string(),
            code: z.string()
        })
    }).catchall(z.any())).describe("The credentials for the client to add to the project. Based on the connector's type, the data will be different. But Before using this tool, you can use the tool 'project-client-credentials' to get the credentials for the project. and especially in the 'required data' section, we need to include the credentials which are marked as `common: false' as these are credentials specific to each client rather than ERP credentials.")
}, async ({ email, password, projectId, name, baseUrl, externalId, extraData, credentials }) => {
    try {
        const { accessToken, organizationId } = await login(email, password);
        const implementationPayload = [{
                name,
                base_url: baseUrl,
                external_id: externalId,
                extra_data: extraData,
                credentials: credentials.map(cred => ({
                    ...cred,
                    external_data: typeof cred.external_data === 'object' ? JSON.stringify(cred.external_data) : cred.external_data
                })),
                project_id: projectId
            }];
        const { data: createResponse } = await axios.post(CREATE_IMPLEMENTATION_URL, implementationPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return {
            content: [{
                    type: "text",
                    text: `Implementation created successfully. ${JSON.stringify(createResponse)}`
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            return {
                content: [{
                        type: "text",
                        text: `Implementation creation Failed: ${axiosError.response?.status} - ${axiosError.message}`
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
// ---- workflows----
server.tool("list-flow-types", {
    email: z.string(),
    password: z.string()
}, async ({ email, password }) => {
    try {
        const { accessToken, organizationId } = await login(email, password);
        const { data: flowTypes } = await axios.get(GET_FLOW_TYPES_URL, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(flowTypes, null, 2)
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            return {
                content: [{
                        type: "text",
                        text: `Cannot get list of flow types: ${axiosError.response?.status} - ${axiosError.message}`
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
server.tool("list-connectors-for-creating-workflows", {
    email: z.string(),
    password: z.string()
}, async ({ email, password }) => {
    try {
        const { accessToken, organizationId } = await login(email, password);
        const { data: connectors } = await axios.get(GET_CONNECTORS_LIST_CONCISE_URL, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
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
                        text: `Cannot get list of connectors: ${axiosError.response?.status} - ${axiosError.message}`
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
server.tool("list-connectors-functions", {
    email: z.string(),
    password: z.string(),
    connectorId: z.number().describe("The Id of the connector to list the functions for, it can be found using list of connectors for creating workflows tool")
}, async ({ email, password, connectorId }) => {
    try {
        const { accessToken, organizationId } = await login(email, password);
        const { data: connectorsFunctions } = await axios.get(GET_CONNECTORS_FUNCTIONS_URL, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                connector_id: connectorId,
                include_common: false
            }
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(connectorsFunctions, null, 2)
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            return {
                content: [{
                        type: "text",
                        text: `Cannot get list of connectors functions: ${axiosError.response?.status} - ${axiosError.message}`
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
// WE NEED A TOOL TO VALIDATE IF THE WORKFLOW IS VALID
server.tool("create-workflow", {
    email: z.string(),
    password: z.string(),
    flowType: z.string().describe("The type of the workflow to create, it can be found using list of flow types tool"),
    projectId: z.number().describe("The Id of the project to create the workflow for"),
    sourceConnectorId: z.number().describe("The Id of the source connector to create the workflow for. We will need the Extractor functions to be listed for the source connector and we can only filter and use the extractor function for the source connector, we can find connector functions using list of connectors functions tool"),
    targetConnectorId: z.number().describe("The Id of the target connector to create the workflow for. We will need the Loader functions to be listed for the target connector and we can only filter and use the loader function for the target connector, we can find connector functions using list of connectors functions tool"),
    triggerFunctionId: z.number().describe("The Id of the trigger function to create the workflow for. list of trigger functions can be found using list of connectors functions tool"),
    extractorFunctionId: z.number().describe("The Id of the extractor function to create the workflow for. list of extractor functions can be found using list of connectors functions tool"),
    transformerFunctionId: z.number().describe("The Id of the transformer function to create the workflow for"),
    loaderFunctionId: z.number().describe("The Id of the loader function to create the workflow for"),
    previousFlowId: z.number().optional().describe("The ID of the previous workflow. If provided, this flow will be triggered after the previous flow completes.")
}, async ({ email, password, flowType, projectId, sourceConnectorId, targetConnectorId, triggerFunctionId, extractorFunctionId, transformerFunctionId, loaderFunctionId, previousFlowId }) => {
    try {
        const { accessToken, organizationId } = await login(email, password);
        const triggerNodeUuid = uuidv4();
        const extractNodeUuid = uuidv4();
        const transformNodeUuid = uuidv4();
        const loadNodeUuid = uuidv4();
        const workflowPayload = {
            flow_type: { id: flowType },
            project: { id: projectId },
            source_connector: { id: sourceConnectorId },
            target_connector: { id: targetConnectorId },
            activities: [
                {
                    wires_in: [],
                    wires_out: [extractNodeUuid],
                    node_uuid: triggerNodeUuid,
                    node_metadata: {
                        x: 443,
                        y: 145.8,
                        absX: 443,
                        absY: 145.8,
                        ...(previousFlowId && { flow_trigger_id: previousFlowId })
                    },
                    connector_function_id: triggerFunctionId
                },
                {
                    wires_in: [triggerNodeUuid],
                    wires_out: [transformNodeUuid],
                    node_uuid: extractNodeUuid,
                    node_metadata: {
                        x: 470,
                        y: 352.2,
                        absX: 470,
                        absY: 352.2
                    },
                    connector_function_id: extractorFunctionId
                },
                {
                    wires_in: [extractNodeUuid],
                    wires_out: [loadNodeUuid],
                    node_uuid: transformNodeUuid,
                    node_metadata: {
                        x: 511,
                        y: 505.4,
                        absX: 511,
                        absY: 505.4,
                        mapping_hint: "",
                        source_json: "",
                        target_json: "",
                        mapping_code: "",
                        mapping_ui_code: [],
                        is_code_mode: true
                    },
                    connector_function_id: transformerFunctionId
                },
                {
                    wires_in: [transformNodeUuid],
                    wires_out: [],
                    node_uuid: loadNodeUuid,
                    node_metadata: {
                        x: 437,
                        y: 628.4,
                        absX: 437,
                        absY: 628.4
                    },
                    connector_function_id: loaderFunctionId
                }
            ]
        };
        const { data: createResponse } = await axios.post(CREATE_WORKFLOW_URL, workflowPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return {
            content: [{
                    type: "text",
                    text: `Workflow created successfully. ${JSON.stringify(createResponse)}`
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            return {
                content: [{
                        type: "text",
                        text: `Cannot create workflow: ${axiosError.response?.status} - ${axiosError.message}`
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
//----------------- Project Applications -------------------
server.tool("add-connector-to-project", {
    email: z.string(),
    password: z.string(),
    id: z.number().describe("The Id of the connector to add to the project and it can be found using list of available connectors tool"),
    projectId: z.number().describe("The Id of the project to add the connector to, When the project is created, the id is returned in the response"),
    name: z.string().describe("The name of the connector to add to the project - it can be found using list of available connectors tool"),
    filename: z.string().describe("The filename of the connector's image to add to the project - it can be found using list of available connectors tool"),
    data: z.record(z.string(), z.any()).describe("Based on the connector's type, the data will be different. But list of records that need to be included can be found in the 'required data' section for each connector in the tool 'list-all-available-connectors'")
}, async ({ email, password, id, projectId, name, filename, data }) => {
    try {
        // Step 1: Login to obtain access token and organization id
        const { accessToken, organizationId } = await login(email, password);
        // Step 2: Build the project creation payload using parameters and organization id
        const projectApplicationPayload = {
            id: id,
            projectId: projectId,
            name: name,
            filename: filename,
            data: JSON.stringify(data)
        };
        // Step 3: Send a POST request to create the project with the access token
        const { data: createResponse } = await axios.post(ADD_CONNECTOR_TO_PROJECT_URL, projectApplicationPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return {
            content: [{
                    type: "text",
                    text: `Application added successfully to the project. ${JSON.stringify(createResponse)}`
                }]
        };
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            return {
                content: [{
                        type: "text",
                        text: `Cannot add connector to project: ${axiosError.response?.status} - ${axiosError.message}`
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
// ------------ Project Applications ------------
server.tool("project-client-credentials", {
    email: z.string(),
    password: z.string(),
    projectId: z.number().describe("The Id of the project to list the connector client credentials for, we get the project id in the response of the tool 'create-project'")
}, async ({ email, password, projectId }) => {
    try {
        const { accessToken, organizationId } = await login(email, password);
        const { data: connectors } = await axios.get(GET_PROJECT_CONNECTOR_CLIENT_CREDENTIALS_URL.replace("{id}", projectId.toString()), {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
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
                        text: `Cannot retrieve the connector client credentials: ${axiosError.response?.status} - ${axiosError.message}`
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
//----------------- Connectors ------------------
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
