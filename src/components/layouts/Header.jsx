import { Link, useLocation } from "react-router-dom";
import { Menu, ListTodo, Wallet, ArrowDownUp, Zap, Layers } from "lucide-react";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Header() {

  const location = useLocation()

  // base menu
  const menu = [
    { name: "Swap", path: "/swap", icon: <Zap className="w-4 h-4" /> },
    { name: "Swap Task", path: "/task", icon: <ListTodo className="w-4 h-4" /> },
    { name: "Subscription", path: "/subscribeswap", icon: <ArrowDownUp className="w-4 h-4" /> },
    { name: "Subscription Task", path: "/mysubscription", icon: <ListTodo className="w-4 h-4" /> },
  ]

  return (
    <header className="w-full border-b border-border backdrop-blur">
      <div className="max-w-[1400px] mx-auto flex justify-between items-center p-5">

        {/* Logo */}
        <div className="flex items-center gap-2 font-bold text-xl">
          <img src="/swifter_white.svg" alt="Swifter Logo" className="w-10 h-10" />
          Swifter AP
        </div>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center gap-6">
          <NavigationMenu>
            <NavigationMenuList>
              {menu.map((item) => (
                <NavigationMenuItem key={item.path}>
                  <NavigationMenuLink
                    asChild
                    className={navigationMenuTriggerStyle()}
                  >
                    <Link
                      to={item.path}
                      className={`flex items-center gap-1.5 px-2 py-1 transition-colors ${location.pathname === item.path
                        ? "text-primary font-semibold border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {item.icon}
                      {item.name}
                    </Link>

                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Tools on right side */}
          <div className="flex items-center gap-3 ml-6">
            {/* <ModeToggle /> */}
            <div className="text-sm [&>button]:px-3 [&>button]:py-1 [&>button]:text-xs [&>button]:rounded-md">
              <ConnectButton label="Connect" showBalance={false} chainStatus="icon" />
            </div>


          </div>
        </nav>

        {/* Mobile Menu */}
        <div className="md:hidden flex items-center gap-3">
          {/* Hamburger */}
          <Sheet>
            <SheetTrigger>
              <Menu className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent side="left" className="p-4">
              <nav className="flex flex-col gap-4 mt-6">
                {menu.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 text-lg ${location.pathname === item.path
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                      }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                ))}
              </nav>
              {/* <div className="mt-6 flex flex-col gap-3">
                <ModeToggle />
              </div> */}
            </SheetContent>
          </Sheet>

          <div className="text-sm [&>button]:px-3 [&>button]:py-1 [&>button]:text-xs [&>button]:rounded-md">
            <ConnectButton label="Connect" showBalance={false} chainStatus="icon" />
          </div>
        </div>

      </div>
    </header>
  );
}
