import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import twilio from "twilio";

// Initialise Express and Twilio client
const app			= express();
const twilioClient	= twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN
);

const openai		= new OpenAI({apiKey: process.env.OPENAI_API_KEY});

// Store conversation threads based on WhatsApp numbers
const threads	= new Map();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Twilio WhatsApp webhook endpoint
app.post("/whatsapp", async(req, res) =>
{
	const incomingMsg	= req.body.Body; // Message received from WhatsApp
	const from			= req.body.From; // Sender's WhatsApp number

	try
	{
		let thread	= threads.get(from);

		if (!thread)
		{
			// Create new thread for first message
			thread	= await openai.beta.threads.create();
			threads.set(from, thread);
		}

		// Add user's message to conversation
		await openai.beta.threads.messages.create(
			thread.id,
			{
				role: "user",
				content: incomingMsg
			}
		);

		// Run OpenAI on entire conversation
		const run	= await openai.beta.threads.runs.create(
			thread.id,
			{assistant_id: "asst_LAi3M1Lo1iVOBVKgIFcjkKFQ"}
		);

		// Wait for completion
		await waitForCompletion(thread.id, run.id);

		// Retrieve messages and find assistant reply
		const messages	= await openai.beta.threads.messages.list(thread.id);
		const reply		= messages.data.find(m => m.role === "assistant")
		?.content[0].text.value;

		if (typeof reply === "string" && reply.trim().length > 0)
		{
			// Send OpenAI response back to sender via Twilio
			await twilioClient.messages.create(
			{
				body: reply,
				from: "whatsapp:+14155238886", // Twilio WhatsApp number
				to: from
			});
			res.status(200).send("Message processed");
		}
		else
		{
			console.error("Error: Empty or whitespace reply from OpenAI.");
			res.status(200).send(
				"Received empty response from OpenAI, no message sent."
			);
		}
	}
	catch (error) 
	{
		console.error("Error processing WhatsApp message:", error);
		res.status(500).send("Internal Server Error");
	}
});

async function waitForCompletion(threadId, runId)
{
	let runStatus;

	do
	{
		await new Promise((resolve) => setTimeout(resolve, 1000));
		runStatus	= await openai.beta.threads.runs.retrieve(threadId, runId);
	}
	while (runStatus === null || runStatus.status !== "completed");
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));