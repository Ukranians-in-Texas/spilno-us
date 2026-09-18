import { useState } from "react";
import { Logo } from "./Logo";
import { CategoryMenu } from "./CategoryMenu";
import { LanguageSelector } from "./LanguageSelector";
import { ThemeToggle } from "./ThemeToggle";
import { MobileMenu } from "./MobileMenu";
import { Button } from "../UI/Button";
import { MenuIcon } from "../UI/Icon";
import { useLanguage } from "../../hooks/useLanguage";

export function Header({ onSelectCategory }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { t } = useLanguage();

    return (
        <>
            <header className="sticky top-0 z-40 py-3 md:py-4 px-4 md:px-8 bg-light-gray">
                <div className="max-w-360 mx-auto bg-white dark:bg-[#0F2040] border border-[#ededed] dark:border-white/10 rounded-[60px] px-5 md:px-7.5 py-3 md:py-5 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <Logo />
                        <CategoryMenu onSelectCategory={onSelectCategory} />
                    </div>

                    <div className="flex items-center gap-5">
                        <div className="hidden md:block">
                            <LanguageSelector />
                        </div>
                        <div className="hidden md:block">
                            <ThemeToggle />
                        </div>
                        <div className="hidden md:block">
                            <Button to="/add-service">
                                {t("header.addService")}
                            </Button>
                        </div>
                        <button
                            className="md:hidden p-2 cursor-pointer"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="Open menu"
                        >
                            <MenuIcon className="w-6 h-6 text-dark-blue" />
                        </button>
                    </div>
                </div>
            </header>

            <MobileMenu
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                onSelectCategory={(cat) => {
                    onSelectCategory(cat);
                    setMobileMenuOpen(false);
                }}
            />
        </>
    );
}
