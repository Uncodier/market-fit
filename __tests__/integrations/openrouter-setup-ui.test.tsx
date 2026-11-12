import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { OpenRouterRecommendations } from "@/app/integrations/components/OpenRouterRecommendations"
import { OpenRouterVerification } from "@/app/integrations/components/OpenRouterVerification"
import { OpenRouterSetupStatus } from "@/app/integrations/components/OpenRouterSetupStatus"
import { OpenRouterModels } from "@/app/integrations/components/OpenRouterModels"

beforeEach(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", { configurable:true, value:()=>"00000000-0000-4000-8000-000000000001" })
  jest.mocked(fetch).mockReset()
})

it("requires one-time explicit selection consent and passes bounded settings", () => {
  const onRecommend=jest.fn()
  render(<OpenRouterRecommendations busy={false} onRecommend={onRecommend} />)
  fireEvent.click(screen.getByText("Automatic model recommendations"))
  const button=screen.getByRole("button",{name:"Generate recommendations"})
  expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.change(screen.getByLabelText("Preferred model vendor (optional)"),{target:{value:"openai"}})
  fireEvent.click(button)
  expect(onRecommend).toHaveBeenCalledWith({operationId:expect.any(String),consent:true,maxCostUsd:0.25,maxPromptPrice:5,maxCompletionPrice:20,preferredVendor:"openai"})
  expect(button).toBeDisabled()
})

it("requires separate image probe consent and an actual selected model", () => {
  const onVerify=jest.fn()
  const view=render(<OpenRouterVerification modelId={null} busy={false} onVerify={onVerify} />)
  fireEvent.click(screen.getByText("Verify image generation"))
  fireEvent.click(screen.getByRole("checkbox"))
  expect(screen.getByRole("button",{name:"Verify selected image model"})).toBeDisabled()
  view.rerender(<OpenRouterVerification modelId="vendor/image" busy={false} onVerify={onVerify} />)
  fireEvent.click(screen.getByRole("button",{name:"Verify selected image model"}))
  expect(onVerify).toHaveBeenCalledWith(expect.objectContaining({modelId:"vendor/image",capability:"image",consent:true,maxCostUsd:0.25}))
  expect(screen.getByRole("checkbox")).not.toBeChecked()
})

it("shows unknown external setup cost rather than inventing zero", async () => {
  jest.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({runs:[{operationId:"00000000-0000-4000-8000-000000000001",kind:"verify",state:"uncertain",maxCostUsd:0.25,gatewayCost:null,createdAt:"now",finishedAt:null,platformCharge:0}]})} as Response)
  render(<OpenRouterSetupStatus siteId="site" />)
  fireEvent.click(screen.getByRole("button",{name:"Check setup status"}))
  await waitFor(()=>expect(screen.getByText(/Unknown — reconcile before retrying/)).toBeInTheDocument())
})

it("can apply completed verification evidence without authorizing another generation",async()=>{
  const operationId="00000000-0000-4000-8000-000000000001";
  jest.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({runs:[{operationId,kind:"verify",state:"completed",maxCostUsd:0.25,gatewayCost:0.05,createdAt:"now",finishedAt:"now",platformCharge:0}]})} as Response)
  const onRecover=jest.fn()
  render(<OpenRouterSetupStatus siteId="site" onRecover={onRecover}/>);
  fireEvent.click(screen.getByRole("button",{name:"Check setup status"}))
  fireEvent.click(await screen.findByRole("button",{name:"Apply saved verification (no generation)"}))
  expect(onRecover).toHaveBeenCalledWith(operationId)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("uses the saved recommendation only when automatic mode is explicitly selected", () => {
  const save=jest.fn()
  render(<OpenRouterModels busy={false} onSave={save} models={[]} connection={{id:"id",siteId:"site",status:"connected",selected:false,revision:1,policyVersion:1,credentialVersion:1,catalogUpdatedAt:null,verifiedAt:null,updatedAt:"now",
    capabilities:{text:{mode:"manual",modelId:"vendor/pinned",status:"unverified",reason:"Manual pin",recommendation:{modelId:"vendor/automatic",reason:"Compatibility evidence; uncertain quality",fingerprint:"a".repeat(64),createdAt:"now",vendorModels:{vendor:"vendor/automatic"}}}}}} />)
  fireEvent.change(screen.getByLabelText("Routing mode"),{target:{value:"automatic"}})
  fireEvent.click(screen.getByRole("button",{name:"Save text conversation"}))
  expect(save).toHaveBeenCalledWith("text","automatic","vendor/automatic",undefined)
})