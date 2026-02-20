import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast, Toaster } from "sonner";
import { CheckCircle, Loader2, Upload } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY"
];

export default function BuyerForm() {
  const [submitted, setSubmitted] = useState(false);
  const [hasCoBuyer, setHasCoBuyer] = useState(false);
  const [personalOrBusiness, setPersonalOrBusiness] = useState<"Personal" | "Business">("Personal");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    coBuyerName: "",
    coBuyerEmail: "",
    businessName: "",
    representativeName: "",
    streetAddress: "",
    city: "",
    state: "FL",
    zipCode: "",
    driverLicenseUrl: "",
    preferredPayment: "Zelle" as "Zelle" | "Cash App" | "Venmo" | "Credit or Debit Card" | "Wire Transfer" | "Other",
  });

  const submitBuyer = trpc.buyers.publicSubmit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setIsSubmitting(false);
    },
    onError: (err) => {
      toast.error("Error submitting form: " + err.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.email || !form.streetAddress || !form.city || !form.zipCode) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    submitBuyer.mutate({
      ...form,
      personalOrBusiness,
      hasCoBuyer: hasCoBuyer ? 1 : 0,
    });
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <Toaster />
        <Card className="w-full max-w-lg text-center">
          <CardContent className="pt-12 pb-10 space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="w-20 h-20 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Thank you!</h2>
            <p className="text-gray-600 text-lg">
              Your information has been submitted successfully.
              <br />
              We will contact you shortly to proceed with the next steps.
            </p>
            <div className="bg-emerald-50 rounded-lg p-4 text-sm text-emerald-800">
              <strong>GT Real Assets LLC (GT Lands)</strong>
              <br />
              📧 gustavo@gtlands.com
              <br />
              📱 (754) 302-2072
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <Toaster />
      
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-center gap-4">
          <img
            src="/gt-lands-logo.png"
            alt="GT Lands"
            className="h-14 w-auto"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GT Lands</h1>
            <p className="text-sm text-gray-500">Buyer Information Form</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Buyer Information</CardTitle>
            <CardDescription>
              Please fill out the form below with your personal information. Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Personal / Business */}
              <div className="space-y-2">
                <Label>Will the contract be in your personal name or Business / LLC? *</Label>
                <Select value={personalOrBusiness} onValueChange={(v) => setPersonalOrBusiness(v as "Personal" | "Business")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personal">Personal</SelectItem>
                    <SelectItem value="Business">Business / LLC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  placeholder="John Smith"
                  value={form.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label>Mobile Phone Number *</Label>
                <Input
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  required
                />
              </div>

              {/* Business fields (only if Business) */}
              {personalOrBusiness === "Business" && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-semibold text-gray-700">Business Information</h3>
                  <div className="space-y-2">
                    <Label>Business / LLC Name *</Label>
                    <Input
                      placeholder="Company Name LLC"
                      value={form.businessName}
                      onChange={(e) => updateField("businessName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Representative Name *</Label>
                    <Input
                      placeholder="Full Name of Representative"
                      value={form.representativeName}
                      onChange={(e) => updateField("representativeName", e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Co-buyer */}
              <div className="space-y-2">
                <Label>Will there be a co-buyer (spouse/partner)?</Label>
                <Select value={hasCoBuyer ? "Yes" : "No"} onValueChange={(v) => setHasCoBuyer(v === "Yes")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Co-buyer fields */}
              {hasCoBuyer && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-700">Co-Buyer Information</h3>
                  <div className="space-y-2">
                    <Label>Co-buyer Full Name *</Label>
                    <Input
                      placeholder="Co-buyer Full Name"
                      value={form.coBuyerName}
                      onChange={(e) => updateField("coBuyerName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Co-buyer Email *</Label>
                    <Input
                      type="email"
                      placeholder="cobuyer@example.com"
                      value={form.coBuyerEmail}
                      onChange={(e) => updateField("coBuyerEmail", e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Address */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700 border-t pt-4">Mailing Address</h3>
                <div className="space-y-2">
                  <Label>Street Address *</Label>
                  <Input
                    placeholder="1234 Main Street, Apt 100"
                    value={form.streetAddress}
                    onChange={(e) => updateField("streetAddress", e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>City *</Label>
                    <Input
                      placeholder="Miami"
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State *</Label>
                    <Select value={form.state} onValueChange={(v) => updateField("state", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ZIP Code *</Label>
                    <Input
                      placeholder="33028"
                      value={form.zipCode}
                      onChange={(e) => updateField("zipCode", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Driver License */}
              <div className="space-y-2">
                <Label>Driver License URL (Google Drive link - front only)</Label>
                <Input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={form.driverLicenseUrl}
                  onChange={(e) => updateField("driverLicenseUrl", e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Upload your driver license photo to Google Drive and paste the sharing link here.
                </p>
              </div>

              {/* Preferred Payment */}
              <div className="space-y-2">
                <Label>Preferred method of payment for down payment *</Label>
                <Select value={form.preferredPayment} onValueChange={(v) => updateField("preferredPayment", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Zelle">Zelle</SelectItem>
                    <SelectItem value="Cash App">Cash App</SelectItem>
                    <SelectItem value="Venmo">Venmo</SelectItem>
                    <SelectItem value="Credit or Debit Card">Credit or Debit Card</SelectItem>
                    <SelectItem value="Wire Transfer">Wire Transfer</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 text-lg bg-emerald-700 hover:bg-emerald-800"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>

              <p className="text-xs text-center text-gray-400">
                GT Real Assets LLC (GT Lands) · Pembroke Pines, FL
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
