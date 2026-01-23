import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { Linkedin, Send, CheckCircle, Loader2, User } from "lucide-react";

export default function LinkedInPanel() {
  const [profile, setProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [postText, setPostText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoadingProfile(true);
      const response = await base44.functions.invoke('linkedinGetProfile', {});
      if (response.data.success) {
        setProfile(response.data.profile);
      }
    } catch (error) {
      console.error('Failed to load LinkedIn profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handlePost = async () => {
    if (!postText.trim()) return;

    setIsPosting(true);
    setPostSuccess(false);

    try {
      const response = await base44.functions.invoke('linkedinPostUpdate', {
        text: postText,
        link_url: linkUrl || undefined,
        link_title: linkTitle || undefined
      });

      if (response.data.success) {
        setPostSuccess(true);
        setPostText("");
        setLinkUrl("");
        setLinkTitle("");
        setTimeout(() => setPostSuccess(false), 3000);
      } else {
        alert('Failed to post: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error posting to LinkedIn: ' + error.message);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-blue-100/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Linkedin className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">LinkedIn Integration</CardTitle>
              <p className="text-sm text-slate-500 mt-0.5">Connected & Active</p>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Profile Info */}
        {isLoadingProfile ? (
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading profile...</span>
          </div>
        ) : profile ? (
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white font-semibold text-lg">
              {profile.first_name?.[0]}{profile.last_name?.[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {profile.first_name} {profile.last_name}
              </p>
              <p className="text-sm text-slate-500">{profile.email}</p>
            </div>
          </div>
        ) : null}

        {/* Post to LinkedIn */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Send className="w-4 h-4" />
            Share Update on LinkedIn
          </h3>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="postText">Post Content</Label>
              <Textarea
                id="postText"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Share insights about plastic injection molding, industry trends, or your latest projects..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-slate-400">
                {postText.length} characters
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="linkUrl">Link URL (optional)</Label>
                <Input
                  id="linkUrl"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkTitle">Link Title (optional)</Label>
                <Input
                  id="linkTitle"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Article or link title"
                />
              </div>
            </div>

            <Button
              onClick={handlePost}
              disabled={!postText.trim() || isPosting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isPosting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : postSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Posted Successfully!
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Post to LinkedIn
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 LinkedIn Engagement Tips</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Share industry insights and manufacturing trends</li>
            <li>• Showcase successful projects (with client permission)</li>
            <li>• Post about innovations in injection molding</li>
            <li>• Engage with prospects by commenting on their posts</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}