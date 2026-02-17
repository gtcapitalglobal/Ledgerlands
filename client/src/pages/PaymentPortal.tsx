import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { trpc } from '../lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { CurrencyInput } from '../components/CurrencyInput';

// Square Web Payments SDK types
declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId?: string) => Promise<{
        card: () => Promise<{
          attach: (elementId: string) => Promise<void>;
          tokenize: () => Promise<{ token: string; status: string }>;
        }>;
      }>;
    };
  }
}

export default function PaymentPortal() {
  const [, params] = useRoute('/pay/:contractId');
  const contractId = params?.contractId ? parseInt(params.contractId) : null;
  
  // Get amount and fees from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const amountFromUrl = urlParams.get('amount');
  const lateFeeFromUrl = urlParams.get('lateFee');
  const processingFeeFromUrl = urlParams.get('processingFee') === 'true';
  
  const { data: contract, isLoading } = trpc.contracts.getById.useQuery(
    { id: contractId! },
    { enabled: !!contractId }
  );

  const [email, setEmail] = useState('');
  const [customAmount, setCustomAmount] = useState(0); // Store in cents
  
  // Pre-fill custom amount if provided in URL
  useEffect(() => {
    if (amountFromUrl) {
      const amountCents = parseInt(amountFromUrl);
      setCustomAmount(amountCents);
    }
  }, [amountFromUrl]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [squareLoaded, setSquareLoaded] = useState(false);
  const [card, setCard] = useState<any>(null);
  
  // Using sonner toast
  const createPaymentMutation = trpc.payments.createSquarePayment.useMutation();

  // Load Square Web Payments SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://web.squarecdn.com/v1/square.js';
    script.async = true;
    script.onload = () => {
      setSquareLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Initialize Square card form
  useEffect(() => {
    if (!squareLoaded || !window.Square || card) return;

    const initializeCard = async () => {
      try {
        const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
        if (!appId) {
          toast.error('Square not configured');
          return;
        }

        const payments = await window.Square!.payments(appId);
        const cardInstance = await payments.card();
        await cardInstance.attach('#card-container');
        setCard(cardInstance);
      } catch (error) {
        console.error('[Square] Failed to initialize:', error);
        toast.error('Failed to load payment form');
      }
    };

    initializeCard();
  }, [squareLoaded, card, toast]);

  const handlePayment = async (amountCents: number) => {
    if (!card || !contractId) {
      toast.error('Payment form not ready');
      return;
    }

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setIsProcessing(true);

    try {
      // Tokenize card
      const result = await card.tokenize();
      if (result.status !== 'OK') {
        throw new Error('Card tokenization failed');
      }

      // Create payment
      await createPaymentMutation.mutateAsync({
        contractId,
        sourceId: result.token,
        amountCents,
        buyerEmail: email,
      });

      toast.success(`Payment of $${(amountCents / 100).toFixed(2)} processed successfully!`);

      // Reset form
      setEmail('');
      setCustomAmount(0);
      
      // Reload card form
      setCard(null);
      setSquareLoaded(false);
      setTimeout(() => setSquareLoaded(true), 100);
    } catch (error: any) {
      console.error('[Payment] Error:', error);
      toast.error(error.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Contract Not Found</CardTitle>
            <CardDescription>The payment link is invalid or expired.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const installmentAmount = contract.installmentAmount 
    ? (typeof contract.installmentAmount === 'string' ? parseFloat(contract.installmentAmount) : contract.installmentAmount)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Make a Payment</CardTitle>
            <CardDescription>Property {contract.propertyId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Contract Info */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Buyer</span>
                <span className="font-medium">{contract.buyerName}</span>
              </div>
              {installmentAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Monthly Payment</span>
                  <span className="font-medium">${installmentAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Fee Breakdown (when fees are present) */}
            {(lateFeeFromUrl || processingFeeFromUrl) && (
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Monthly Payment</span>
                  <span className="font-medium">${installmentAmount.toFixed(2)}</span>
                </div>
                {lateFeeFromUrl && (
                  <div className="flex justify-between text-orange-600">
                    <span className="text-sm">Late Fee</span>
                    <span className="font-medium">${(parseInt(lateFeeFromUrl) / 100).toFixed(2)}</span>
                  </div>
                )}
                {processingFeeFromUrl && (() => {
                  const base = installmentAmount;
                  const late = lateFeeFromUrl ? parseInt(lateFeeFromUrl) / 100 : 0;
                  const subtotal = base + late;
                  const fee = subtotal * 0.04;
                  return (
                    <div className="flex justify-between text-primary">
                      <span className="text-sm">Processing Fee (4%)</span>
                      <span className="font-medium">${fee.toFixed(2)}</span>
                    </div>
                  );
                })()}
                <div className="border-t border-primary/20 pt-2 mt-2">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total Amount</span>
                    <span>
                      ${(() => {
                        const base = installmentAmount;
                        const late = lateFeeFromUrl ? parseInt(lateFeeFromUrl) / 100 : 0;
                        const subtotal = base + late;
                        const fee = processingFeeFromUrl ? subtotal * 0.04 : 0;
                        return (subtotal + fee).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            {/* Square Card Form */}
            <div className="space-y-2">
              <Label>Card Information</Label>
              <div 
                id="card-container" 
                className="border rounded-md p-3 min-h-[120px]"
              />
            </div>

            {/* Payment Buttons */}
            <div className="space-y-3">
              {installmentAmount > 0 && !amountFromUrl && (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => handlePayment(Math.round(installmentAmount * 100))}
                  disabled={isProcessing || !card}
                >
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Pay Monthly Amount (${installmentAmount.toFixed(2)})
                </Button>
              )}

              <div className="space-y-2">
                <Label htmlFor="customAmount">Custom Amount</Label>
                <div className="flex gap-2">
                  <CurrencyInput
                    id="customAmount"
                    value={customAmount}
                    onChange={(cents) => setCustomAmount(cents)}
                    disabled={isProcessing}
                  />
                  <Button
                    onClick={() => {
                      if (customAmount > 0) {
                        handlePayment(customAmount);
                      } else {
                        toast.error('Please enter a valid amount');
                      }
                    }}
                    disabled={isProcessing || !card || !customAmount}
                  >
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Pay
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-xs text-muted-foreground text-center pt-4 border-t">
              Payments are processed securely by Square. Your card information is never stored on our servers.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
