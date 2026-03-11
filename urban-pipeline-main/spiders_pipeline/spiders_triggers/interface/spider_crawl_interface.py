from abc import ABC, abstractmethod


class ISpiderTrigger(ABC):
    @abstractmethod
    def _trigger_spider(self, spider_name: str) -> dict[str, str]:
        """Trigger a spider from the given scrapyd API endpoint"""
        pass
