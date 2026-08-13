import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { scanUserRateLimit } from '../middleware/rateLimit.js';
import axios from 'axios';

const router = Router();

// Follow redirects to unshorten a URL
router.post('/unshorten', scanUserRateLimit, async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'URL is required' } });
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
       return res.status(400).json({ success: false, error: { message: 'Invalid URL protocol' } });
    }
  } catch (err) {
    return res.status(400).json({ success: false, error: { message: 'Invalid URL format' } });
  }

  try {
    let currentUrl = url;
    let hops = [url];
    let maxRedirects = 5;
    let redirectCount = 0;

    // Use axios to manually follow redirects to capture the chain
    while (redirectCount < maxRedirects) {
      try {
        const response = await axios.head(currentUrl, {
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
          timeout: 5000,
        });

        // 3xx status codes indicate a redirect
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
          const nextUrl = new URL(response.headers.location, currentUrl).toString();
          hops.push(nextUrl);
          currentUrl = nextUrl;
          redirectCount++;
        } else {
          // No more redirects
          break;
        }
      } catch (err) {
        // If it throws, check if it's because of maxRedirects (we set it to 0 so it always throws on 3xx if we don't catch it in validateStatus, but validateStatus handles it)
        break;
      }
    }

    res.json({
      success: true,
      data: {
        originalUrl: url,
        finalUrl: currentUrl,
        hops: hops,
        redirectCount: redirectCount
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Failed to unshorten URL' } });
  }
});

export default router;
