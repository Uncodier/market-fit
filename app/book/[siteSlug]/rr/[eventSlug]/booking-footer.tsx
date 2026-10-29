"use client";
import { Button } from "@/app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Sun, Moon } from "@/app/components/ui/icons";
import { SupportedLocale } from "@/app/context/LocalizationContext";
import type { BookingViewState } from "./booking-view-state";
export function BookingFooter(state: BookingViewState) {
    const { isEmbed, theme, setTheme, locale, setLocale, t } = state;
    return (<>
        {!isEmbed && (<footer className="w-full py-4 px-4 sm:px-6 bg-background mt-auto">
          <div className="max-w-4xl w-full mx-auto flex flex-col sm:flex-row items-center justify-end gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? (<Sun className="h-4 w-4"/>) : (<Moon className="h-4 w-4"/>)}
              </Button>

              <div className="h-3 w-[1px] bg-border/40"/>

              <Select value={locale} onValueChange={(v) => setLocale(v as SupportedLocale)}>
                <SelectTrigger className="w-fit bg-transparent border-none shadow-none focus:ring-0 px-0 h-auto text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
                  <div className="flex items-center gap-1">
                    <SelectValue placeholder={t("booking.language")}/>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">EN</SelectItem>
                  <SelectItem value="es">ES</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </footer>)}

  </>);
}
