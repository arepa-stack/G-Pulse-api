import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY not found in environment variables.");
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Just to access clean generic client if I could, but wait, listModels is on the client? 
        // Actually listModels is not directly on GoogleGenerativeAI instance in the node SDK roughly. 
        // Wait, the SDK documentation says:
        // import { GoogleGenerativeAI } from "@google/generative-ai";
        // const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // There isn't a direct listModels helper in the simplified GoogleGenerativeAI class in earlier versions, 
        // but in 0.24.1 it might be there or we have to use the direct API.

        // Let's try to use the REST API manually for listing models to be sure, or check if the SDK supports it.
        // The error message said: "Call ListModels to see the list of available models"

        // Let's use a simple fetch to the API endpoint to be dependency-agnostic for listing.

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach((m: any) => {
                console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
            });
        } else {
            console.error("No models found or error:", data);
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
