import { Link, useLocation } from "wouter";
import { Building2, LayoutDashboard, Users, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [location] = useLocation();

  const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leads", label: "Leads", icon: Users },
    { href: "/leads/new", label: "Add Leads", icon: PlusCircle },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card shadow-sm h-14">
      <div className="flex h-full items-center justify-between px-4 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 mr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg hidden sm:inline-block tracking-tight text-foreground">
              RMA
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                location === link.href ||
                (link.href !== "/" && location.startsWith(link.href));

              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={`gap-2 ${isActive ? "font-semibold bg-secondary/80" : "text-muted-foreground"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
