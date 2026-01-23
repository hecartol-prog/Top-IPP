import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { text, link_url, link_title } = await req.json();

        if (!text) {
            return Response.json({ 
                error: 'Text content is required' 
            }, { status: 400 });
        }

        // Get LinkedIn access token
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("linkedin");

        // First, get the user's LinkedIn ID
        const meResponse = await fetch(
            'https://api.linkedin.com/v2/me',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!meResponse.ok) {
            return Response.json({ 
                error: 'Failed to get LinkedIn profile' 
            }, { status: meResponse.status });
        }

        const meData = await meResponse.json();
        const personId = meData.id;

        // Create the post payload
        const postPayload = {
            author: `urn:li:person:${personId}`,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: {
                        text: text
                    },
                    shareMediaCategory: link_url ? "ARTICLE" : "NONE"
                }
            },
            visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        };

        // Add link if provided
        if (link_url) {
            postPayload.specificContent["com.linkedin.ugc.ShareContent"].media = [{
                status: "READY",
                originalUrl: link_url,
                title: {
                    text: link_title || link_url
                }
            }];
        }

        // Post to LinkedIn
        const postResponse = await fetch(
            'https://api.linkedin.com/v2/ugcPosts',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0'
                },
                body: JSON.stringify(postPayload)
            }
        );

        if (!postResponse.ok) {
            const errorData = await postResponse.text();
            return Response.json({ 
                error: 'Failed to post to LinkedIn',
                details: errorData,
                status: postResponse.status
            }, { status: postResponse.status });
        }

        const postData = await postResponse.json();

        return Response.json({
            success: true,
            post_id: postData.id,
            message: 'Successfully posted to LinkedIn',
            data: postData
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});