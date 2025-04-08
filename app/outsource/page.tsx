"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import {
  ChevronRight,
  FileText,
  Tag,
  Clock,
  Shield,
  CheckCircle2,
  ChevronDown
} from "@/app/components/ui/icons"

export default function OutsourcePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background py-12">
      <div className="container px-4 mx-auto">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-4">Outsource Your Tasks</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Let our experts handle your tasks while you focus on growing your business
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card className="bg-background border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5 text-primary" />
                  Save Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Free up your schedule by delegating time-consuming tasks to our skilled professionals
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Quality Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Get high-quality work from specialists with years of industry experience
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="w-5 h-5 text-primary" />
                  Secure Process
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Your data is protected and confidentiality is guaranteed throughout the process
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-background border-border shadow-sm mb-12">
            <CardHeader>
              <CardTitle className="text-xl">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-8">
                <div className="flex gap-5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-medium">1</div>
                  <div>
                    <h3 className="font-medium text-base mb-1">Submit Your Task</h3>
                    <p className="text-muted-foreground text-sm">
                      Provide details about your task and any specific requirements
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-medium">2</div>
                  <div>
                    <h3 className="font-medium text-base mb-1">Expert Assignment</h3>
                    <p className="text-muted-foreground text-sm">
                      We assign the perfect specialist based on your task requirements
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-medium">3</div>
                  <div>
                    <h3 className="font-medium text-base mb-1">Task Execution</h3>
                    <p className="text-muted-foreground text-sm">
                      Our expert completes your task with regular status updates
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-medium">4</div>
                  <div>
                    <h3 className="font-medium text-base mb-1">Review & Delivery</h3>
                    <p className="text-muted-foreground text-sm">
                      Review the completed task and provide feedback
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2 border-t">
              <Button 
                className="w-full"
                size="lg"
                onClick={() => router.push('/outsource/checkout')}
              >
                Get Started <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-5 mb-12">
            <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
            
            <div className="space-y-3">
              <details className="group border rounded-lg">
                <summary className="flex cursor-pointer items-center justify-between p-4">
                  <h3 className="font-medium">What types of tasks can I outsource?</h3>
                  <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>You can outsource a variety of tasks including content creation, data entry, research, design work, administrative tasks, and more. If you're unsure if your task is eligible, please reach out to our support team.</p>
                </div>
              </details>

              <details className="group border rounded-lg">
                <summary className="flex cursor-pointer items-center justify-between p-4">
                  <h3 className="font-medium">How much does it cost?</h3>
                  <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>Pricing depends on the complexity and scope of your task. Basic tasks start at $199, while more complex projects are priced based on requirements and timeline. You'll receive a transparent quote before committing.</p>
                </div>
              </details>

              <details className="group border rounded-lg">
                <summary className="flex cursor-pointer items-center justify-between p-4">
                  <h3 className="font-medium">How long does it take to complete a task?</h3>
                  <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>Completion time varies based on task complexity and scope. Simple tasks may be completed within 24-48 hours, while more complex projects might take several days or weeks. You can specify your deadline when submitting your task.</p>
                </div>
              </details>

              <details className="group border rounded-lg">
                <summary className="flex cursor-pointer items-center justify-between p-4">
                  <h3 className="font-medium">How do you ensure quality and confidentiality?</h3>
                  <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>All our experts undergo rigorous vetting and sign confidentiality agreements. We have a multi-step quality assurance process to ensure your tasks meet the highest standards. Your data is encrypted and handled according to strict privacy protocols.</p>
                </div>
              </details>
            </div>
          </div>

          <div className="text-center">
            <Button 
              size="lg" 
              className="px-10"
              onClick={() => router.push('/outsource/checkout')}
            >
              Outsource Your Task Now <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 