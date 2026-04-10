import { useState } from "react";
import { useGetCurrentPlayer, useUpdateProfile, useChangePassword } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Save, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}

function ProfileContent() {
  const { data: player } = useGetCurrentPlayer();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState(player?.fullName ?? "");
  const [phone, setPhone] = useState((player as any)?.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleUpdateProfile = () => {
    updateProfile.mutate(
      { data: { fullName: fullName || undefined, phone: phone || undefined } },
      {
        onSuccess: () => { toast({ title: "Profile updated!" }); qc.invalidateQueries(); },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      toast({ title: "Fill in both password fields", variant: "destructive" });
      return;
    }
    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: () => {
          toast({ title: "Password changed!" });
          setCurrentPassword("");
          setNewPassword("");
        },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error, variant: "destructive" }),
      }
    );
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-black mb-6 flex items-center gap-2">
          <User className="w-6 h-6 text-primary" />
          Profile Settings
        </h1>

        <Card className="border-primary/10 mb-6">
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={player?.email ?? ""} disabled className="mt-1 bg-muted/50" />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>
            <div>
              <Label>Full Name</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
                className="mt-1"
                data-testid="input-full-name"
              />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="555-1234"
                className="mt-1"
                data-testid="input-phone"
              />
            </div>
            <Button onClick={handleUpdateProfile} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                className="mt-1"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={changePassword.isPending} variant="outline">
              {changePassword.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
