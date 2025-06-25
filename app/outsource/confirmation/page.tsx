"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { 
  Check,
  ChevronRight,
  Clock,
  Mail,
} from "@/app/components/ui/icons"

export default function OutsourceConfirmationPage() {
  const router = useRouter()

  // Update the page title
  useEffect(() => {
    document.title = "Order Confirmation | Outsource"
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex flex-col items-center justify-start pt-12 pb-16">
      <div className="container max-w-2xl px-4 mx-auto">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-3">Task Submitted Successfully!</h1>
          <p className="text-muted-foreground text-center max-w-md">
            Your task has been received and our team will begin working on it shortly
          </p>
        </div>

        <Card className="mb-8 border-border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              What Happens Next
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-semibold text-primary">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-base mb-1">Initial Review</h3>
                  <p className="text-muted-foreground text-sm">
                    Our team will review your task request within 24 hours
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-semibold text-primary">2</span>
                </div>
                <div>
                  <h3 className="font-medium text-base mb-1">Task Assignment</h3>
                  <p className="text-muted-foreground text-sm">
                    We'll assign the perfect specialist to work on your task
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-semibold text-primary">3</span>
                </div>
                <div>
                  <h3 className="font-medium text-base mb-1">Progress Updates</h3>
                  <p className="text-muted-foreground text-sm">
                    You'll receive regular updates on the progress of your task
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-semibold text-primary">4</span>
                </div>
                <div>
                  <h3 className="font-medium text-base mb-1">Task Delivery</h3>
                  <p className="text-muted-foreground text-sm">
                    We'll deliver the completed task according to your requirements
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 border-border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Order Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              A confirmation email has been sent to your email address with all the details of your order. 
              If you have any questions or need to provide additional information, please reply to that email.
            </p>
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Order Reference:</span>
                <span className="text-sm">ORD-{Math.floor(100000 + Math.random() * 900000)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Estimated Delivery:</span>
                <span className="text-sm">
                  {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Payment Status:</span>
                <span className="text-sm text-primary font-medium">Completed</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end pt-4 border-t">
            <Button 
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 