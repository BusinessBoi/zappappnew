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

app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Twilio WhatsApp webhook endpoint
app.post("/whatsapp", async(req, res) =>
{
	const incomingMsg	= req.body.Body; // Message received from WhatsApp
	const from			= req.body.From; // Sender's WhatsApp number

	try
	{
		// Assuming assistant ID already retrieved
		const thread	= await openai.beta.threads.create();
		await openai.beta.threads.messages.create(thread.id,
		{
			role: "user",
			content: incomingMsg
		});
		const run	= await openai.beta.threads.runs.create(
			thread.id,
			{assistant_id: "asst_LAi3M1Lo1iVOBVKgIFcjkKFQ"}
		);

		let runStatus;
		let retries	= 3; // Number of retries
		do
		{
			await new Promise(resolve => setTimeout(resolve, 1000));
			runStatus	= await openai.beta.threads.runs.retrieve(
				thread.id,
				run.id
			);
			retries--;
		}
		while
		(retries > 0 &&
			(runStatus === null || runStatus.status !== "completed")
		);

		if (runStatus && runStatus.status === "completed")
		{
			const messages	= await openai.beta.threads.messages.list(
				thread.id
			);
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
		else
		{
			console.error("Error: No reply from OpenAI after retries.");
			res.status(200).send("No response from OpenAI, no message sent.");
		}
	}
	catch (error) 
	{
		console.error("Error processing WhatsApp message:", error);
		res.status(500).send("Internal Server Error");
	}
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));