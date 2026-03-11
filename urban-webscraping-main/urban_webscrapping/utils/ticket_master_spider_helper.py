from scrapy.spiders import Spider


class TicketMasterHelper():
    def __init__(self):
        ...
        
    def process_event(self, event):
        """Extrai e estrutura os dados de um único evento"""
        # Informações básicas
        event_id = event.get('id', '')
        name = event.get('name', '')
        event_url = event.get('url', '')
        
        # Data e hora
        dates = event.get('dates', {}).get('start', {})
        date_start = dates.get('localDate', '')
        time_start = dates.get('localTime', '')
        datetime_utc = dates.get('dateTime', '')
        
        # Imagem (seleciona a de maior resolução)
        image_url = self._get_best_image(event.get('images', []))
        
        # Localização (usa o primeiro venue)
        venue = event.get('_embedded', {}).get('venues', [{}])[0]
        location = venue.get('name', '')
        postal_code = venue.get('postalCode', '')
        coords = venue.get('location', {})
        latitude = coords.get('latitude', '')
        longitude = coords.get('longitude', '')
        
        return {
            "id": event_id,
            "name": name,
            "event_url": event_url,
            "image_url": image_url,
            "date_start": date_start,
            "time_start": time_start,
            "datetime": datetime_utc,
            "location": location,
            "postal_code": postal_code,
            "latitude": latitude,
            "longitude": longitude
        }
        
    def _get_best_image(self, images):
        """Seleciona a imagem de maior resolução disponível"""
        if not images:
            return ''
        
        # Tenta encontrar a imagem SOURCE (original)
        for img in images:
            if img.get('attribution', '').lower().find('source') != -1:
                return img.get('url', '')
        
        # Fallback: seleciona pela maior resolução
        return max(
            images, 
            key=lambda x: x.get('width', 0) * x.get('height', 0), 
            default={'url': ''}
        ).get('url', '')

    def errback(self, failure):
        self.logger.error(f"Request failed: {failure}")