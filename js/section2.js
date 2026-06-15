// 1. 카드 스크롤 진입/이탈 감지기 (기존 유지)
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        } else {
            entry.target.classList.remove('active');
        }
    });
}, { threshold: 0.4, rootMargin: "0px 0px -10% 0px" });


// 2. 섹션 2 GeoJSON 연동 및 통합 로직
async function initSection2Map() {
    const mapS2 = L.map('map-s2', { zoomControl: false, scrollWheelZoom: false }).setView([37.5759, 126.9850 - 0.01], 15);
    // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    // }).addTo(mapS2);
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    //     attribution: '© OpenStreetMap contributors'
    // }).addTo(mapS2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapS2);

    const pathLine = L.polyline([], {
        color: '#000000', weight: 3, dashArray: '8, 8', opacity: 1, lineJoin: 'round'
    }).addTo(mapS2);

    try {
        const response = await fetch('./data/section2.geojson');
        const geojsonData = await response.json();

        const targetIds = ["43", "13", "70", "20", "37", "42", "40"];
        const timelineData = [];
        const locationsS2 = [];

        // [데이터 추출] 
        targetIds.forEach(targetId => {
            const feature = geojsonData.features.find(f => String(f.id) === targetId);

            if (feature) {
                timelineData.push({
                    id: targetId,
                    date: feature.properties.DATE || feature.properties.ADDR_OLD || "날짜 없음",
                    title: feature.properties.TITLE || feature.properties.CONTENTS_NAME,
                    desc: feature.properties.DESC || feature.properties.VALUE_03 || "설명 정보가 없습니다.",
                    imgUrl: feature.properties.IMG_MAIN_URL || ""
                });

                let coords = null;
                if (feature.geometry.type === 'Point') {
                    coords = feature.geometry.coordinates;
                } else if (feature.geometry.type === 'GeometryCollection') {
                    const pointGeo = feature.geometry.geometries.find(g => g.type === 'Point');
                    if (pointGeo) coords = pointGeo.coordinates;
                }

                if (coords) {
                    locationsS2.push({
                        id: targetId,
                        pos: [coords[1], coords[0]],
                        label: feature.properties.CONTENTS_NAME,
                        address: feature.properties.ADDR_OLD || "주소 정보 없음"
                    });
                }
            }
        });

        // [HTML 카드 동적 생성]
        const timelineList = document.getElementById('sc2-timeline-list');
        timelineList.innerHTML = '';

        timelineData.forEach(item => {
            const imageHTML = item.imgUrl ? `<img src="${item.imgUrl}" alt="${item.title}" class="sc2-item-img">` : "";

            const cardHTML = `
                <div class="sc2-timeline-item sc2-scroll-reveal" data-marker="${item.id}">
                    <span class="sc2-item-date">${item.date}</span>
                    <h3 class="sc2-item-title">${item.title}</h3>
                    ${imageHTML} <p class="sc2-item-desc">${item.desc}</p>
                </div>
            `;
            timelineList.insertAdjacentHTML('beforeend', cardHTML);
        });

        document.querySelectorAll('.sc2-scroll-reveal').forEach(el => revealObserver.observe(el));

        // [마커 및 툴팁 생성]
        const markers = {};

        locationsS2.forEach(loc => {
            const stepNumber = targetIds.indexOf(loc.id) + 1;
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div class='sc2-marker-wrapper sc2-marker-hidden' id='map-marker-container-${loc.id}'>
                        <div class='sc2-marker-circle'>${stepNumber}</div>
                        <div class='sc2-marker-label'>${loc.label}</div>
                    </div>
                `,
                iconSize: [30, 42], iconAnchor: [15, 42]
            });

            const marker = L.marker(loc.pos, { icon }).addTo(mapS2);

            marker.bindTooltip(loc.address, {
                permanent: true,
                direction: 'top',
                className: 'sc2-marker-tooltip sc2-tooltip-hidden',
                offset: [0, -40]
            });

            markers[loc.id] = { marker, tooltip: marker.getTooltip() };
        });

        // [스크롤 감지 로직 - 마커/툴팁 제어]
        const markerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const activeId = String(entry.target.getAttribute('data-marker'));
                    const activeIndex = targetIds.indexOf(activeId);

                    // 1. 툴팁 제어
                    Object.keys(markers).forEach(key => {
                        const tooltipEl = markers[key]?.tooltip?.getElement();
                        if (tooltipEl) {
                            if (key === activeId) {
                                tooltipEl.classList.remove('sc2-tooltip-hidden');
                            } else {
                                tooltipEl.classList.add('sc2-tooltip-hidden');
                            }
                        }
                    });

                    // 2. 마커 누적 제어
                    targetIds.forEach((id, index) => {
                        const container = document.getElementById(`map-marker-container-${id}`);
                        if (container) {
                            if (index <= activeIndex) {
                                if (container.classList.contains('sc2-marker-hidden')) {
                                    container.classList.remove('sc2-marker-hidden');
                                    container.classList.add('sc2-marker-visible', 'sc2-marker-animate');
                                }
                            } else {
                                container.classList.remove('sc2-marker-visible', 'sc2-marker-animate');
                                container.classList.add('sc2-marker-hidden');
                            }
                        }
                    });

                    // 3. 점선 업데이트
                    const visibleCoords = targetIds
                        .filter((_, index) => index <= activeIndex)
                        .map(id => locationsS2.find(l => l.id === id)?.pos)
                        .filter(Boolean);

                    pathLine.setLatLngs(visibleCoords);
                }
            });
        }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

        document.querySelectorAll('.sc2-timeline-item').forEach(item => markerObserver.observe(item));

    } catch (error) {
        console.error('GeoJSON 데이터 로드 에러:', error);
    }
}

// 스크립트 실행 (오류 방지를 위해 DOMContentLoaded 안에 넣었습니다)
document.addEventListener("DOMContentLoaded", () => {
    initSection2Map();
});