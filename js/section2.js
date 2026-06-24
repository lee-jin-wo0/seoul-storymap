// [곡선 생성 도우미 함수]
function generateCurvedPath(coords) {
    if (coords.length < 2) return coords;

    let curvedCoords = [];

    for (let i = 0; i < coords.length - 1; i++) {
        const start = coords[i];
        const end = coords[i + 1];

        const lat1 = start[0], lng1 = start[1];
        const lat2 = end[0], lng2 = end[1];

        const midLat = (lat1 + lat2) / 2;
        const midLng = (lng1 + lng2) / 2;

        const dLat = lat2 - lat1;
        const dLng = lng2 - lng1;

        const intensity = 0.2;
        const isTargetLine = (i === 0 || i === 1 || i === 4);
        const direction = isTargetLine ? 1 : -1;
        const offset = intensity * direction;

        const cpLat = midLat - (dLng * offset);
        const cpLng = midLng + (dLat * offset);

        const steps = 20;
        for (let step = 0; step <= steps; step++) {
            const t = step / steps;
            const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cpLat + t * t * lat2;
            const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * cpLng + t * t * lng2;

            if (i > 0 && step === 0) continue;
            curvedCoords.push([lat, lng]);
        }
    }
    return curvedCoords;
}

// 1. 섹션 2 전용: 카드 스크롤 진입/이탈 감지기
const sc2RevealObserver = new IntersectionObserver((entries) => {
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
    const mapContainer = document.getElementById('map-s2');
    if (!mapContainer) return;

    const mapS2 = L.map('map-s2', { zoomControl: false, scrollWheelZoom: false }).setView([37.5759 + 0.001, 126.9850 - 0.01], 15.2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
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

        // 데이터 추출
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

        // HTML 카드 동적 생성
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

        document.querySelectorAll('.sc2-scroll-reveal').forEach(el => sc2RevealObserver.observe(el));

        // 마커 및 툴팁 생성
        const markers = {};
        locationsS2.forEach(loc => {
            const stepNumber = targetIds.indexOf(loc.id) + 1;
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `
                <div class='sc2-marker-wrapper sc2-marker-dimmed' id='map-marker-container-${loc.id}'>
                    <div class='sc2-marker-circle'>${stepNumber}</div>
                </div>
                `,
                iconSize: [30, 30], iconAnchor: [15, 15]
            });

            const marker = L.marker(loc.pos, { icon }).addTo(mapS2);
            const tooltipContent = `
                <div style="text-align: center;">
                    <div style="font-weight: bold;">${loc.label}</div>
                </div>
            `;

            marker.bindTooltip(tooltipContent, {
                permanent: true, direction: 'top', className: 'sc2-marker-tooltip', offset: [0, -15]
            });

            markers[loc.id] = { marker, tooltip: marker.getTooltip() };
        });

        const initialCoords = targetIds.map(id => locationsS2.find(l => l.id === id)?.pos).filter(Boolean);
        const curvedInitialCoords = generateCurvedPath(initialCoords);
        pathLine.setLatLngs(curvedInitialCoords);

        // 스크롤 감지 로직 - 마커/툴팁 제어
        const markerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const activeId = String(entry.target.getAttribute('data-marker'));
                    const activeIndex = targetIds.indexOf(activeId);

                    Object.keys(markers).forEach(key => {
                        const tooltipEl = markers[key]?.tooltip?.getElement();
                        if (tooltipEl) {
                            if (key === activeId) {
                                tooltipEl.classList.remove('sc2-tooltip-dimmed');
                                tooltipEl.classList.add('sc2-tooltip-active');
                            } else {
                                tooltipEl.classList.remove('sc2-tooltip-active');
                                tooltipEl.classList.add('sc2-tooltip-dimmed');
                            }
                        }
                    });

                    targetIds.forEach((id, index) => {
                        const container = document.getElementById(`map-marker-container-${id}`);
                        if (container) {
                            if (index <= activeIndex) {
                                container.classList.remove('sc2-marker-dimmed');
                                container.classList.add('sc2-marker-active');
                            } else {
                                container.classList.remove('sc2-marker-active');
                                container.classList.add('sc2-marker-dimmed');
                            }
                        }
                    });

                    const visibleCoords = targetIds.slice(0, activeIndex + 1).map(id => locationsS2.find(l => l.id === id)?.pos).filter(Boolean);
                    const curvedVisibleCoords = generateCurvedPath(visibleCoords);
                    pathLine.setLatLngs(curvedVisibleCoords);
                    pathLine.setStyle({ opacity: 1 });
                }
            });
        }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

        document.querySelectorAll('.sc2-timeline-item').forEach(item => markerObserver.observe(item));

    } catch (error) {
        console.error('Section 2 GeoJSON 로드 에러:', error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initSection2Map();
});