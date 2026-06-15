// 1. 카드 스크롤 진입/이탈 감지기 (섹션 2와 동일한 효과)
const sc3RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        } else {
            entry.target.classList.remove('active');
        }
    });
}, { threshold: 0.4, rootMargin: "0px 0px -10% 0px" });

// 2. 섹션 3 GeoJSON 연동 및 스크롤 맵 로직
async function initSection3Map() {
    // [지도 초기화] - 화면 전체 고정
    const mapS3 = L.map('map-s3', { zoomControl: false, scrollWheelZoom: false }).setView([37.5665, 126.9780 - 0.01], 15);

    // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    // }).addTo(mapS3);
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    //     attribution: '© OpenStreetMap contributors'
    // }).addTo(mapS3);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapS3);

    let activeGeoJsonLayer = null; // 현재 지도에 그려진 선 레이어
    let activeMarkers = []; // [추가] 출발, 도착 마커들을 관리할 배열

    // [표시할 순서 및 ID 정의] (geojson 안의 id 매핑)
    const sc3Groups = [
        { id: 'east-1', targetIds: ["52"] },
        { id: 'east-2', targetIds: ["50"] },
        { id: 'west-1', targetIds: ["51"] },
        { id: 'west-2', targetIds: ["53"] },
        { id: 'west-3', targetIds: ["49"] },
        { id: 'march5-1', targetIds: ["48"] },
        { id: 'march5-2', targetIds: ["47"] }
    ];

    try {
        // [GeoJSON 데이터 로드]
        const response = await fetch('./data/section3.geojson');
        const sc3Data = await response.json();

        const timelineList = document.getElementById('sc3-timeline-list');
        timelineList.innerHTML = '';

        // [HTML 카드 동적 생성]
        sc3Groups.forEach(group => {
            // GeoJSON 데이터에서 targetId에 해당하는 feature 찾기
            const feature = sc3Data.features.find(f => String(f.id) === group.targetIds[0]);

            if (feature) {
                const props = feature.properties;

                // 데이터 매핑
                const title = props.CONTENTS_NAME || "제목 없음";
                const name1 = props.NAME_01 || "";
                const val1 = props.VALUE_01 || "";
                const name2 = props.NAME_02 || "";
                // 세부내용의 \n 문자를 HTML 줄바꿈(<br>)으로 변환
                const val2 = props.VALUE_02 ? props.VALUE_02.replace(/\n/g, '<br>') : "";

                // 카드 HTML 조립 (데이터가 있는 경우에만 영역 렌더링)
                const cardHTML = `
                    <div class="sc3-timeline-item sc3-scroll-reveal" data-feature-id="${group.targetIds[0]}">
                        <h3 class="sc3-item-title">${title}</h3>
                        
                        ${(name1 || val1) ? `
                        <div class="sc3-route-box">
                            ${name1 ? `<strong class="sc3-route-label">${name1}</strong>` : ''}
                            <p class="sc3-route-val">${val1}</p>
                        </div>
                        ` : ''}
                        
                        ${(name2 || val2) ? `
                        <div class="sc3-desc-box">
                            ${name2 ? `<strong class="sc3-route-label">${name2}</strong>` : ''}
                            <p class="sc3-item-desc">${val2}</p>
                        </div>
                        ` : ''}
                    </div>
                `;
                timelineList.insertAdjacentHTML('beforeend', cardHTML);
            }
        });

        // 카드 생성 후 나타남 효과(Reveal) 옵저버 연결
        document.querySelectorAll('.sc3-scroll-reveal').forEach(el => sc3RevealObserver.observe(el));

        // [스크롤 감지 로직 - 지도 선 제어 및 애니메이션]
        const mapUpdateObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const featureId = entry.target.getAttribute('data-feature-id');
                    const targetFeature = sc3Data.features.find(f => String(f.id) === featureId);

                    // 1. 기존에 그려진 선 및 마커 지우기
                    if (activeGeoJsonLayer) {
                        mapS3.removeLayer(activeGeoJsonLayer);
                    }
                    activeMarkers.forEach(m => mapS3.removeLayer(m));
                    activeMarkers = []; // 배열 초기화

                    // 2. 새로운 선 지도에 그리기
                    if (targetFeature) {
                        activeGeoJsonLayer = L.geoJSON(targetFeature, {
                            style: {
                                color: '#ffffff',
                                weight: 6,
                                opacity: 0.9,
                                lineJoin: 'round',
                                className: 'sc3-draw-path' // [수정] 스르륵 그려질 애니메이션 타겟 클래스
                            }
                        }).addTo(mapS3);

                        // 3. 출발점, 도착점 마커 생성 로직
                        let lineCoords = [];
                        if (targetFeature.geometry.type === 'GeometryCollection') {
                            const lineStringGeo = targetFeature.geometry.geometries.find(g => g.type === 'LineString');
                            if (lineStringGeo) lineCoords = lineStringGeo.coordinates;
                        } else if (targetFeature.geometry.type === 'LineString') {
                            lineCoords = targetFeature.geometry.coordinates;
                        }

                        if (lineCoords.length > 0) {
                            const startCoord = [lineCoords[0][1], lineCoords[0][0]];
                            const endCoord = [lineCoords[lineCoords.length - 1][1], lineCoords[lineCoords.length - 1][0]];

                            const startIcon = L.divIcon({
                                className: 'sc3-point-marker start',
                                html: '<div class="sc3-point-label">출발</div><div class="sc3-point-dot"></div>',
                                iconSize: [40, 40], iconAnchor: [20, 40]
                            });

                            const endIcon = L.divIcon({
                                className: 'sc3-point-marker end',
                                html: '<div class="sc3-point-label">도착</div><div class="sc3-point-dot"></div>',
                                iconSize: [40, 40], iconAnchor: [20, 40]
                            });

                            activeMarkers.push(L.marker(startCoord, { icon: startIcon }).addTo(mapS3));
                            activeMarkers.push(L.marker(endCoord, { icon: endIcon }).addTo(mapS3));
                        }

                        // // 4. 지도 뷰 부드럽게 이동
                        // mapS3.fitBounds(activeGeoJsonLayer.getBounds(), {
                        //     padding: [50, 50],
                        //     animate: true,
                        //     duration: 1.5
                        // });

                        // 5. [추가] 출발지점에서 도착지점까지 선이 스르륵 그려지는 애니메이션
                        setTimeout(() => {
                            const paths = document.querySelectorAll('.sc3-draw-path');
                            paths.forEach(path => {
                                // 선의 실제 길이 계산
                                const length = path.getTotalLength();

                                // 선 길이만큼 여백을 주어 처음엔 숨김 처리
                                path.style.strokeDasharray = length;
                                path.style.strokeDashoffset = length;

                                // 강제 Reflow 발생시켜 브라우저가 시작점을 인식하게 함
                                path.getBoundingClientRect();

                                // CSS 트랜지션을 걸고 offset을 0으로 당겨와 선을 그림
                                path.style.transition = 'stroke-dashoffset 2.5s ease-in-out';
                                path.style.strokeDashoffset = '0';
                            });
                        }, 0); // 지도 포커스 이동 후 0초 뒤부터 선 그리기 시작
                    }
                }
            });
        }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

        // 각 카드에 지도 업데이트 옵저버 연결
        document.querySelectorAll('.sc3-timeline-item').forEach(item => mapUpdateObserver.observe(item));

    } catch (error) {
        console.error('Section 3 GeoJSON 데이터 로드 에러:', error);
    }
}

// 스크립트 실행
document.addEventListener("DOMContentLoaded", () => {
    initSection3Map();
});