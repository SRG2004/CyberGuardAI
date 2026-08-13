"""
CyberGuard AI — Hugging Face Gradio Space Entrypoint
Pure Gradio App for ZeroGPU compatibility.
"""
import gradio as gr
import spaces

def check_url(url: str):
    try:
        from main import predict_url, UrlRequest
        res = predict_url(UrlRequest(url=url))
        return {
            "score": res["score"],
            "label": res["label"],
            "confidence": res["confidence"],
            "features": res["features"],
            "transformer_enhanced": res.get("transformer_enhanced", False),
        }
    except Exception as e:
        return {"error": str(e)}

def check_email(subject: str, body: str):
    try:
        from main import predict_email, EmailRequest
        res = predict_email(EmailRequest(subject=subject, body=body))
        return {
            "score": res["score"],
            "label": res["label"],
            "signals": res.get("signals", []),
            "highlights": res.get("highlights", []),
            "transformer_enhanced": res.get("transformer_enhanced", False),
        }
    except Exception as e:
        return {"error": str(e)}

@spaces.GPU
def gpu_check_url(url: str):
    return check_url(url)

@spaces.GPU
def gpu_check_email(subject: str, body: str):
    return check_email(subject, body)

@spaces.GPU
def dummy_gpu_task():
    return "ZeroGPU Connected"

def health_check():
    return {"status": "ok", "model_loaded": True}

with gr.Blocks(title="CyberGuard AI — Threat Detection API") as demo:
    gr.Markdown("# 🛡️ CyberGuard AI — Threat Detection Microservice")
    gr.Markdown("Pure Gradio backend microservice running on Hugging Face Spaces free tier.")

    with gr.Tab("URL Scanner"):
        url_input = gr.Textbox(label="Enter URL", placeholder="https://example.com")
        url_button = gr.Button("Scan URL")
        url_output = gr.JSON(label="Scan Results")
        url_button.click(gpu_check_url, inputs=[url_input], outputs=[url_output], api_name="predict_url")

    with gr.Tab("Email Analyzer"):
        email_subj = gr.Textbox(label="Subject", placeholder="Urgent: Verify Account")
        email_body = gr.TextArea(label="Body", placeholder="Please click here to verify...")
        email_button = gr.Button("Analyze Email")
        email_output = gr.JSON(label="Analysis Results")
        email_button.click(gpu_check_email, inputs=[email_subj, email_body], outputs=[email_output], api_name="predict_email")

    with gr.Tab("System Status"):
        gpu_button = gr.Button("Check GPU Status")
        gpu_output = gr.Textbox(label="Status")
        gpu_button.click(dummy_gpu_task, inputs=[], outputs=[gpu_output], api_name="gpu_health")
        
        health_btn = gr.Button("Check Health")
        health_out = gr.JSON()
        health_btn.click(health_check, inputs=[], outputs=[health_out], api_name="health")

# Hugging Face looks for 'demo' or 'app'
app = demo
