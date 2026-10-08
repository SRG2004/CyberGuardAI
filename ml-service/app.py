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
            "verdict": res.get("verdict", "safe"),
            "riskScore": res.get("riskScore", 0),
            "confidence": res.get("confidence", 0),
            "xai_analysis": res.get("xai_analysis", []),
        }
    except Exception as e:
        return {"error": str(e)}

def check_email(subject: str, body: str):
    try:
        from main import predict_email, EmailRequest
        res = predict_email(EmailRequest(subject=subject, body=body))
        return {
            "verdict": res.get("verdict", "safe"),
            "riskScore": res.get("riskScore", 0),
            "confidence": res.get("confidence", 0),
            "xai_analysis": res.get("xai_analysis", []),
        }
    except Exception as e:
        return {"error": str(e)}

def check_page(url: str, forms_str: str, iframes_str: str, dom_anomalies_str: str, js_signals_str: str, redirect_chain_str: str):
    try:
        import json
        from main import predict_page, PageRequest
        req = PageRequest(
            url=url,
            forms=json.loads(forms_str) if forms_str else [],
            iframes=json.loads(iframes_str) if iframes_str else [],
            dom_anomalies=json.loads(dom_anomalies_str) if dom_anomalies_str else [],
            js_signals=json.loads(js_signals_str) if js_signals_str else [],
            redirect_chain=json.loads(redirect_chain_str) if redirect_chain_str else []
        )
        res = predict_page(req)
        return {
            "verdict": res.get("label", "safe"),
            "riskScore": res.get("score", 0) * 100,
            "xai_analysis": res.get("signals", [])
        }
    except Exception as e:
        return {"error": str(e), "verdict": "unknown", "riskScore": 0, "xai_analysis": []}

@spaces.GPU
def gpu_check_url(url: str):
    return check_url(url)

@spaces.GPU
def gpu_check_page(*args):
    return check_page(*args)

@spaces.GPU
def gpu_check_email(subject: str, body: str):
    return check_email(subject, body)

@spaces.GPU
def gpu_check_qr(img_arr):
    try:
        import cv2
        from main import predict_url, UrlRequest
        detector = cv2.QRCodeDetector()
        data, bbox, _ = detector.detectAndDecode(img_arr)
        if not data:
            return {"verdict": "safe", "url": "", "error": "No QR code found"}
        res = predict_url(UrlRequest(url=data))
        return {
            "verdict": res.get("verdict", "safe"),
            "riskScore": res.get("riskScore", 0),
            "confidence": res.get("confidence", 0),
            "xai_analysis": res.get("xai_analysis", []),
            "url": data
        }
    except Exception as e:
        return {"error": str(e)}

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

    with gr.Tab("Page Scanner"):
        page_url = gr.Textbox(label="URL")
        page_forms = gr.Textbox(label="Forms (JSON string)")
        page_iframes = gr.Textbox(label="Iframes (JSON string)")
        page_dom = gr.Textbox(label="DOM Anomalies (JSON string)")
        page_js = gr.Textbox(label="JS Signals (JSON string)")
        page_redirects = gr.Textbox(label="Redirect Chain (JSON string)")
        page_btn = gr.Button("Scan Page")
        page_out = gr.JSON()
        page_btn.click(gpu_check_page, inputs=[page_url, page_forms, page_iframes, page_dom, page_js, page_redirects], outputs=[page_out], api_name="predict_page")

    with gr.Tab("Email Analyzer"):
        email_subj = gr.Textbox(label="Subject", placeholder="Urgent: Verify Account")
        email_body = gr.TextArea(label="Body", placeholder="Please click here to verify...")
        email_button = gr.Button("Analyze Email")
        email_output = gr.JSON(label="Analysis Results")
        email_button.click(gpu_check_email, inputs=[email_subj, email_body], outputs=[email_output], api_name="predict_email")

    with gr.Tab("QR Scanner"):
        qr_input = gr.Image(label="Upload QR Code")
        qr_button = gr.Button("Scan QR")
        qr_output = gr.JSON(label="QR Scan Results")
        qr_button.click(gpu_check_qr, inputs=[qr_input], outputs=[qr_output], api_name="predict_qr")

    with gr.Tab("System Status"):
        gpu_button = gr.Button("Check GPU Status")
        gpu_output = gr.Textbox(label="Status")
        gpu_button.click(dummy_gpu_task, inputs=[], outputs=[gpu_output], api_name="gpu_health")
        
        health_btn = gr.Button("Check Health")
        health_out = gr.JSON()
        health_btn.click(health_check, inputs=[], outputs=[health_out], api_name="health")

# Hugging Face looks for 'demo' or 'app'
app = demo
if __name__ == "__main__":
    demo.launch(server_port=8001)