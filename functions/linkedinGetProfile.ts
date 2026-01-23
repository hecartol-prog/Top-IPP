import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get LinkedIn access token
        const accessToken = await base44.asServiceRole.connectors.getAccessToken("linkedin");

        // Get user profile
        const profileResponse = await fetch(
            'https://api.linkedin.com/v2/me',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!profileResponse.ok) {
            const errorData = await profileResponse.text();
            return Response.json({ 
                error: 'LinkedIn API error',
                details: errorData
            }, { status: profileResponse.status });
        }

        const profileData = await profileResponse.json();

        // Get email address
        const emailResponse = await fetch(
            'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let email = null;
        if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            email = emailData.elements?.[0]?.['handle~']?.emailAddress;
        }

        return Response.json({
            success: true,
            profile: {
                id: profileData.id,
                first_name: profileData.localizedFirstName,
                last_name: profileData.localizedLastName,
                email: email,
                profile_url: `https://www.linkedin.com/in/${profileData.vanityName || profileData.id}`
            },
            raw: profileData
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});