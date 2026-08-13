"""
CyberGuard AI — Hugging Face Gradio Space Entrypoint
Mounts FastAPI (/predict/url, /predict/email, /health) with a Gradio Web UI interface.
Compatible with both CPU Basic and ZeroGPU hardware on HF Spaces.
"""

import gradio as gr

import spaces

from main import app as fastapi_app


def _check_url_impl(url: str):
    """Core URL check logic."""
    try:
        from main import predict_url, UrlRequest
        res = predict_url(UrlRequest(url=url))
        return {
            "Label": res["label"],
            "Risk Score": f"{res['score'] * 100:.1f}%",
            "Confidence": f"{res['confidence'] * 100:.1f}%",
            "Transformer Enhanced": res.get("transformer_enhanced", False),
            "Detected Features": res["features"],
        }
    except Exception as e:
        return {"Error": str(e)}


def _check_email_impl(subject: str, body: str):
    """Core email check logic."""
    try:
        from main import predict_email, EmailRequest
        res = predict_email(EmailRequest(subject=subject, body=body))
        return {
            "Label": res["label"],
            "Risk Score": f"{res['score'] * 100:.1f}%",
            "Text Probability": f"{res['text_probability'] * 100:.1f}%",
            "Urgency Score": f"{res['urgency_score'] * 100:.1f}%",
            "Transformer Enhanced": res.get("transformer_enhanced", False),
        }
    except Exception as e:
        return {"Error": str(e)}

@spaces.GPU
def dummy_gpu_task():
    return "ZeroGPU Connected"


def check_url(url: str):
    import requests
    try:
        res = requests.post("http://127.0.0.1:7860/predict/url", json={"url": url})
        return res.json()
    except Exception as e:
        return {"error": str(e)}


def check_email(subject: str, body: str):
    import requests
    try:
        res = requests.post("http://127.0.0.1:7860/predict/email", json={"subject": subject, "body": body})
        return res.json()
    except Exception as e:
        return {"error": str(e)}


# Create Gradio UI for manual interactive testing
with gr.Blocks(title="CyberGuard AI — Threat Detection API") as demo:
    gr.Markdown("# 🛡️ CyberGuard AI — Threat Detection Microservice")
    gr.Markdown("FastAPI backend microservice running on Hugging Face Spaces free tier.")

    with gr.Tab("URL Scanner"):
        url_input = gr.Textbox(label="Enter URL", placeholder="https://example.com")
        url_button = gr.Button("Scan URL")
        url_output = gr.JSON(label="Scan Results")
        url_button.click(check_url, inputs=[url_input], outputs=[url_output])

    with gr.Tab("Email Analyzer"):
        email_subj = gr.Textbox(label="Subject", placeholder="Urgent: Verify Account")
        email_body = gr.TextArea(label="Body", placeholder="Please click here to verify...")
        email_button = gr.Button("Analyze Email")
        email_output = gr.JSON(label="Analysis Results")
        email_button.click(check_email, inputs=[email_subj, email_body], outputs=[email_output])

    with gr.Tab("System Status"):
        gpu_button = gr.Button("Check GPU Status")
        gpu_output = gr.Textbox(label="Status")
        gpu_button.click(dummy_gpu_task, inputs=[], outputs=[gpu_output])

    gr.Markdown("### API Endpoints\n- `POST /predict/url` — URL analysis\n- `POST /predict/email` — Email analysis\n- `GET /health` — Health check")

# Mount FastAPI app onto Gradio so REST API endpoints still work
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
