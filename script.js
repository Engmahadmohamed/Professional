// API Keys
const REMOVE_BG_API_KEY = 'aNNmEpAec4g4nrx3ZYr6nCS8';
const FREEPIK_API_KEY = 'aTWKJFHjVbiUyY8z46dQMJFyxvDXiTAZSA1RGsbeC1IRD4cJ9svTUz98';

// DOM Elements
const removeBgUpload = document.getElementById('removeBgUpload');
const removeBgInput = document.getElementById('removeBgInput');
const removeBgResult = document.getElementById('removeBgResult');
const processedImage = document.getElementById('processedImage');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const photosGrid = document.getElementById('photosGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// Remove Background functionality
removeBgUpload.addEventListener('click', () => {
    removeBgInput.click();
});

removeBgUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    removeBgUpload.style.borderColor = '#2980b9';
});

removeBgUpload.addEventListener('dragleave', () => {
    removeBgUpload.style.borderColor = '#3498db';
});

removeBgUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    removeBgUpload.style.borderColor = '#3498db';
    const file = e.dataTransfer.files[0];
    if (file) {
        processImage(file);
    }
});

removeBgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processImage(file);
    }
});

async function processImage(file) {
    // Validate file size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > MAX_FILE_SIZE) {
        alert('Error: Image size must be less than 5MB');
        return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Error: Please upload a valid image file (JPEG, PNG, or WebP)');
        return;
    }

    const formData = new FormData();
    formData.append('image_file', file);

    try {
        // Show loading state
        removeBgUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>Processing image...</p>';

        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: {
                'X-Api-Key': REMOVE_BG_API_KEY
            },
            body: formData
        });

        // Check if response is OK before attempting to parse JSON
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the response content type
        const contentType = response.headers.get('content-type');
        
        // Handle binary response (image data)
        if (contentType && contentType.includes('image/')) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            processedImage.src = url;
            removeBgUpload.style.display = 'none';
            removeBgResult.hidden = false;
            return;
        }

        // Handle JSON response (error messages)
        const responseData = await response.json();
        if (!responseData || !responseData.data || !responseData.data.result_b64) {
            let errorMessage = 'Failed to remove background';
            if (responseData && responseData.errors && responseData.errors.length > 0) {
                errorMessage = responseData.errors[0].title || errorMessage;
            }
            throw new Error(errorMessage);
        }

        // Process base64 image data
        const imageResponse = await fetch('data:image/png;base64,' + responseData.data.result_b64);
        const blob = await imageResponse.blob();
        const url = URL.createObjectURL(blob);
        processedImage.src = url;
        removeBgUpload.style.display = 'none';
        removeBgResult.hidden = false;
    } catch (error) {
        // Reset upload area
        removeBgUpload.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><p>Drag & Drop or Click to Upload</p>';
        alert('Error: ' + error.message);
    }
}

// Freepik Photos functionality
let currentPage = 1;
let currentQuery = '';

searchBtn.addEventListener('click', () => {
    currentQuery = searchInput.value.trim();
    currentPage = 1;
    searchPhotos();
});

loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    searchPhotos();
});

async function searchPhotos() {
    try {
        // Show loading state
        photosGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Loading photos...</p></div>';
        loadMoreBtn.style.display = 'none';

        if (!currentQuery) {
            photosGrid.innerHTML = '<div class="no-results">Please enter a search term</div>';
            return;
        }

        // Enhanced retry logic with exponential backoff
        let retries = 7; // Increased to 7 retries for better resilience
        let retryDelay = 2000; // Start with 2 second delay for better stability
        let response;
        let lastError;

        while (retries > 0) {
            try {
                // Check for online status
                if (!navigator.onLine) {
                    throw new Error('You are currently offline. Please check your internet connection.');
                }

                response = await Promise.race([
                    fetch(`https://api.freepik.com/v1/resources?locale=en-US&page=${currentPage}&query=${encodeURIComponent(currentQuery)}&limit=20`, {
                        headers: {
                            'Authorization': `Bearer ${FREEPIK_API_KEY}`,
                            'Accept': 'application/json'
                        },
                        // Add cache control for better performance
                        cache: 'no-cache',
                        // Add timeout at fetch level
                        signal: AbortSignal.timeout(30000) // 30s timeout
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Request timeout: The server is taking too long to respond. Please try again.')), 30000)
                    )
                ]);
                
                // If successful, clear any previous error state
                if (response.ok) {
                    break;
                } else {
                    throw new Error(`HTTP Error: ${response.status}`);
                }
            } catch (error) {
                lastError = error;
                retries--;
                
                // Handle specific error cases
                if (error.name === 'AbortError') {
                    throw new Error('The request was aborted due to timeout. Please try again.');
                }
                
                if (retries === 0) {
                    throw new Error(
                        'Network error: Unable to connect to the server. Please try refreshing the page or check if the service is available.'
                    );
                }

                const remainingAttempts = retries;
                const waitTime = retryDelay / 1000;
                
                // Show detailed retry status to user
                photosGrid.innerHTML = `
                    <div class="loading">
                        <i class="fas fa-sync fa-spin"></i>
                        <p>Connection attempt failed: ${error.message}</p>
                        <p>Retrying in ${waitTime} seconds... (${remainingAttempts} attempts remaining)</p>
                        <button onclick="searchPhotos()" class="retry-now-btn">Retry Now</button>
                    </div>`;
                
                console.log(`Retry attempt ${7 - retries} after ${retryDelay}ms. Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retryDelay = Math.min(retryDelay * 1.5, 15000); // More gradual increase, capped at 15 seconds
            }
        }

        // Handle HTTP errors
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait a moment and try again.');
            } else if (response.status === 401) {
                throw new Error('Authentication failed. Please check your API key.');
            } else if (response.status === 404) {
                throw new Error('Resource not found. Please try a different search term.');
            } else {
                throw new Error(`API Error: ${response.status} - ${response.statusText}`);
            }
        }

        const data = await response.json();
        
        if (currentPage === 1) {
            photosGrid.innerHTML = '';
        }

        if (!data.data || data.data.length === 0) {
            if (currentPage === 1) {
                photosGrid.innerHTML = '<div class="no-results">No photos found. Try different keywords.</div>';
            }
            loadMoreBtn.style.display = 'none';
            return;
        }

        data.data.forEach(photo => {
            const photoElement = document.createElement('div');
            photoElement.className = 'photo-item';
            photoElement.innerHTML = `
                <img src="${photo.thumbnail}" alt="${photo.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/150x150.png?text=Image+Not+Found'">
                <div class="photo-overlay">
                    <p class="photo-title">${photo.title}</p>
                    <a href="${photo.url}" target="_blank" class="download-link">Download</a>
                </div>
            `;
            photosGrid.appendChild(photoElement);
        });

        loadMoreBtn.style.display = data.data.length === 20 ? 'block' : 'none';
    } catch (error) {
        console.error('Search photos error:', error);
        photosGrid.innerHTML = `<div class="error"><i class="fas fa-exclamation-circle"></i><p>${error.message}</p><button onclick="searchPhotos()">Try Again</button></div>`;
        loadMoreBtn.style.display = 'none';
    }
}

// Add download functionality
const downloadBtn = document.querySelector('.download-btn');

downloadBtn.addEventListener('click', async () => {
    if (!processedImage.src) return;

    try {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';

        const response = await fetch(processedImage.src);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `removed-bg-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        downloadBtn.innerHTML = 'Download';
        downloadBtn.disabled = false;
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download image. Please try again.');
        downloadBtn.innerHTML = 'Download';
        downloadBtn.disabled = false;
    }
});

// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');


// Add touch event support and prevent default behavior
mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event from bubbling up
    navLinks.classList.toggle('active');
    // Toggle aria-expanded for accessibility
    const isExpanded = navLinks.classList.contains('active');
    mobileMenuBtn.setAttribute('aria-expanded', isExpanded);
    // Toggle menu icon
    mobileMenuBtn.querySelector('i').classList.toggle('fa-bars');
    mobileMenuBtn.querySelector('i').classList.toggle('fa-times');
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('active') && !e.target.closest('.navbar')) {
        navLinks.classList.remove('active');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mobileMenuBtn.querySelector('i').classList.add('fa-bars');
        mobileMenuBtn.querySelector('i').classList.remove('fa-times');
    }
});

// Add smooth scrolling and close menu for navigation links
navLinks.querySelectorAll('a').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const section = document.querySelector(this.getAttribute('href'));
        if (section) {
            // Close mobile menu
            navLinks.classList.remove('active');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            mobileMenuBtn.querySelector('i').classList.add('fa-bars');
            mobileMenuBtn.querySelector('i').classList.remove('fa-times');
            
            // Smooth scroll to section
            section.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Add smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const section = document.querySelector(this.getAttribute('href'));
        if (section) {
            section.scrollIntoView({
                behavior: 'smooth'
            });
            // Close mobile menu if open
            navLinks.classList.remove('active');
        }
    });
});

// Dynamic Navigation
const sections = document.querySelectorAll('section');

// Update active section on scroll
window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= (sectionTop - sectionHeight / 3)) {
            current = section.getAttribute('id');
        }
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
});
const navLinks = document.querySelector('.nav-links');
const navLinksAnchors = navLinks.querySelectorAll('a');

// Update active section on scroll
window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= (sectionTop - sectionHeight / 3)) {
            current = section.getAttribute('id');
        }
    });

    navLinksAnchors.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
});