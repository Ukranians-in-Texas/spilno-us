import { ServiceCard } from "../ServiceCard/ServiceCard";
import { Button } from "../UI/Button";
import { useLanguage } from "../../hooks/useLanguage";

export function ServiceList({ services, loading, error, onRetry, title, onSubcategoryClick }) {
    const { t } = useLanguage();
    if (loading) {
        return (
            <section className="py-12 px-4">
                <div className="max-w-360 mx-auto">
                    {title && (
                        <h2 className="text-2xl font-bold text-dark-blue mb-8">
                            {title}
                        </h2>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={i}
                                className="bg-white dark:bg-[#0F2040] rounded-2xl shadow-card p-5 animate-pulse"
                            >
                                <div className="h-4 bg-gray rounded w-3/4 mb-3" />
                                <div className="h-3 bg-gray rounded w-1/2 mb-2" />
                                <div className="h-3 bg-gray rounded w-2/3 mb-2" />
                                <div className="h-3 bg-gray rounded w-1/3" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="py-12 px-4">
                <div className="max-w-360 mx-auto text-center">
                    <p className="text-text/70 mb-4">{t("services.error")}</p>
                    <Button variant="outline" onClick={onRetry}>
                        {t("services.retry")}
                    </Button>
                </div>
            </section>
        );
    }

    if (services.length === 0) {
        return (
            <section className="py-12 px-4">
                <div className="max-w-360 mx-auto text-center">
                    <p className="text-text/70 mb-4">
                        {t("services.emptyCategory")}
                    </p>
                    <Button to="/add-service">
                        {t("header.addService")}
                    </Button>
                </div>
            </section>
        );
    }

    return (
        <section className="py-12 px-4">
            <div className="max-w-360 mx-auto">
                {title && (
                    <h2 className="text-2xl font-bold text-dark-blue mb-8">
                        {title}
                    </h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((service) => (
                        <ServiceCard key={service.id} service={service} onSubcategoryClick={onSubcategoryClick} />
                    ))}
                </div>
            </div>
        </section>
    );
}
